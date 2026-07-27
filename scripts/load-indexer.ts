//
// HD-04 — Load test do indexer. Registra um lote de versículos reais em devnet e
// mede quanto tempo cada um leva para aparecer como REGISTERED na WebApi (o
// espelho off-chain), exercitando as 3 camadas (webhook/evento + PENDING +
// reconciliação) sob volume.
//
//   pnpm load:indexer -- --count 40 --web-api https://<webapi>.lambda-url...aws/
//   pnpm load:indexer -- --count 40 --book 19 --chapter 119   (Salmo 119: 176 versos)
//
// Precisa de: carteira com SOL em devnet, canon selado, e a WebApi + indexer no
// ar (deploy). Escolhe versículos AVAILABLE de um capítulo grande, registra-os, e
// faz polling da WebApi até REGISTERED, reportando vazão e latência (send →
// indexado). Um versículo que não indexa dentro do timeout é uma FALHA do teste.
//
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { CatalogProver, PROGRAM_ID, configPda, decodeConfig } from '@eternal-word/blockchain'
import type { VerseAddress } from '@eternal-word/domain'
import { Connection, Keypair } from '@solana/web3.js'
import { argAt, buildRegisterTx } from './register-helpers.js'

interface Options {
  url: string
  keypairPath: string
  webApi: string
  book: number
  chapter: number
  count: number
  concurrency: number
  pollTimeoutMs: number
}

function parseArgs(argv: readonly string[]): Options {
  const webApi = argAt(argv, '--web-api') ?? process.env.WEB_API_URL
  if (!webApi) throw new Error('--web-api <url> (or WEB_API_URL) is required')
  return {
    url: argAt(argv, '--url') ?? 'https://api.devnet.solana.com',
    keypairPath: argAt(argv, '--keypair') ?? `${homedir()}/.config/solana/id.json`,
    webApi: webApi.replace(/\/$/, ''),
    book: Number(argAt(argv, '--book') ?? 19),
    chapter: Number(argAt(argv, '--chapter') ?? 119),
    count: Number(argAt(argv, '--count') ?? 25),
    concurrency: Number(argAt(argv, '--concurrency') ?? 8),
    pollTimeoutMs: Number(argAt(argv, '--poll-timeout-ms') ?? 180_000),
  }
}

interface VerseStatus {
  status: string | null
  registrable: boolean
}

async function readStatus(webApi: string, v: VerseAddress): Promise<VerseStatus> {
  const res = await fetch(`${webApi}/?book=${v.book}&chapter=${v.chapter}&verse=${v.verse}`)
  if (!res.ok) return { status: null, registrable: false }
  return (await res.json()) as VerseStatus
}

/** Percorre o capítulo colhendo os primeiros `count` versículos AVAILABLE. */
async function pickAvailable(o: Options): Promise<VerseAddress[]> {
  const picked: VerseAddress[] = []
  for (let verse = 1; picked.length < o.count && verse <= 200; verse++) {
    const address = { book: o.book, chapter: o.chapter, verse }
    const { status, registrable } = await readStatus(o.webApi, address)
    if (registrable && status === 'AVAILABLE') picked.push(address)
  }
  if (picked.length < o.count) {
    throw new Error(`only ${picked.length} AVAILABLE verses found in ${o.book}:${o.chapter}`)
  }
  return picked
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function main() {
  const o = parseArgs(process.argv.slice(2))
  const connection = new Connection(o.url, 'confirmed')
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(o.keypairPath, 'utf8'))),
  )
  const prover = new CatalogProver()

  process.stdout.write(
    [
      'Eternal Word — HD-04 indexer load test',
      `program:  ${PROGRAM_ID.toBase58()}`,
      `wallet:   ${wallet.publicKey.toBase58()}`,
      `cluster:  ${o.url}`,
      `web api:  ${o.webApi}`,
      `target:   ${o.count} verses from ${o.book}:${o.chapter}`,
      '',
    ].join('\n'),
  )

  const [config] = configPda()
  const configInfo = await connection.getAccountInfo(config)
  if (configInfo === null || !decodeConfig(configInfo.data).sealed) {
    throw new Error('canon is not sealed — run `pnpm bootstrap:devnet` first')
  }

  const targets = await pickAvailable(o)
  process.stdout.write(`Registering ${targets.length} verses (concurrency ${o.concurrency})…\n`)

  const sentAt = new Map<string, number>()
  const key = (v: VerseAddress) => `${v.book}:${v.chapter}:${v.verse}`

  await mapWithConcurrency(targets, o.concurrency, async (address) => {
    const { transaction } = await buildRegisterTx(connection, wallet, prover, address)
    const signature = await connection.sendTransaction(transaction)
    sentAt.set(key(address), Date.now())
    // Camada 2: PENDING otimista, como o site faz (best-effort). De um único IP,
    // o WRITE_LIMITER da WebApi (ver ADR de custo) pode 429 a maioria — por isso
    // é best-effort; para exercitar a camada 2 sob carga, suba WEB_API_WRITE_*.
    await fetch(`${o.webApi}/pending`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...address, transaction: signature }),
    }).catch(() => undefined)
    await connection.confirmTransaction(signature, 'confirmed')
  })

  process.stdout.write('All submitted. Polling the mirror until REGISTERED…\n')

  const deadline = Date.now() + o.pollTimeoutMs
  const latencyMs = new Map<string, number>()
  const pending = new Set(targets.map(key))
  while (pending.size > 0 && Date.now() < deadline) {
    for (const address of targets) {
      const k = key(address)
      if (!pending.has(k)) continue
      const { status } = await readStatus(o.webApi, address)
      if (status === 'REGISTERED') {
        latencyMs.set(k, Date.now() - (sentAt.get(k) ?? Date.now()))
        pending.delete(k)
      }
    }
    if (pending.size > 0) await new Promise((r) => setTimeout(r, 3_000))
  }

  const latencies = [...latencyMs.values()].sort((a, b) => a - b)
  const pct = (p: number) =>
    latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]
  process.stdout.write(
    [
      '',
      `indexed:  ${latencyMs.size}/${targets.length}`,
      `latency:  min ${latencies[0] ?? '—'}ms · p50 ${pct(0.5) ?? '—'}ms · max ${latencies.at(-1) ?? '—'}ms`,
      pending.size > 0
        ? `NOT indexed within timeout: ${[...pending].join(', ')}`
        : 'all indexed ✅',
      '',
    ].join('\n'),
  )
  if (pending.size > 0) process.exit(1)
  process.stdout.write('Load test passed — the 3 layers kept up under the batch.\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
