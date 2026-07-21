//
// PG-08 smoke test: the one irreversible part of the system, exercised for real
// on devnet after the canon is sealed (`pnpm bootstrap:devnet`).
//
//   pnpm smoke:devnet                    against the default wallet
//   pnpm smoke:devnet -- --keypair PATH
//
// It proves, on-chain:
//   - Genesis 1:1 registers (a real verse becomes a permanent account)
//   - Esther 8:9 (the longest verse) registers WITH a ComputeBudget attached —
//     the practical proof of the PG-00 transaction-budget analysis
//   - a second Genesis 1:1 is refused (duplicate impossible by construction)
// and measures the real rent per VerseAccount and compute units consumed, the
// numbers PG-10 substitutes for the ADR estimates.
//
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  CatalogProver,
  PROGRAM_ID,
  configPda,
  decodeConfig,
  registerVerseTransaction,
  versePda,
} from '@eternal-word/blockchain'
import type { VerseAddress } from '@eternal-word/domain'
import { Connection, Keypair, type VersionedTransaction } from '@solana/web3.js'

interface Options {
  url: string
  keypairPath: string
}

function parseArgs(argv: readonly string[]): Options {
  const at = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    url: at('--url') ?? 'https://api.devnet.solana.com',
    keypairPath: at('--keypair') ?? `${homedir()}/.config/solana/id.json`,
  }
}

const address = (book: number, chapter: number, verse: number): VerseAddress => ({
  book,
  chapter,
  verse,
})

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const connection = new Connection(options.url, 'confirmed')
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(options.keypairPath, 'utf8'))),
  )
  const prover = new CatalogProver()

  process.stdout.write(
    [
      'Eternal Word — PG-08 smoke test',
      `program:  ${PROGRAM_ID.toBase58()}`,
      `wallet:   ${wallet.publicKey.toBase58()}`,
      `cluster:  ${options.url}`,
      '',
    ].join('\n'),
  )

  // The canon must be sealed — registration is gated on it. If it is not, the
  // bootstrap has not finished; fail loudly instead of getting a confusing
  // on-chain error per registration.
  const [config] = configPda()
  const configInfo = await connection.getAccountInfo(config)
  if (configInfo === null) throw new Error('config account missing — run `pnpm bootstrap:devnet`')
  if (!decodeConfig(configInfo.data).sealed) {
    throw new Error('canon is not sealed yet — the bootstrap must finish first')
  }

  const { blockhash } = await connection.getLatestBlockhash()

  const register = async (verse: VerseAddress, label: string) => {
    const { text, proof } = prover.proofFor(verse)
    const transaction = registerVerseTransaction({
      adopter: wallet.publicKey,
      address: verse,
      text,
      proof,
      recentBlockhash: blockhash,
      computeUnitLimit: 400_000,
      priorityFeeMicroLamports: 1000,
    })
    transaction.sign([wallet])
    const wireBytes = transaction.serialize().length
    const signature = await connection.sendTransaction(transaction)
    await connection.confirmTransaction(signature, 'confirmed')

    const detail = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    })
    const [pda] = versePda(verse)
    const account = await connection.getAccountInfo(pda)

    process.stdout.write(
      [
        `✅ ${label} — ${verse.book}:${verse.chapter}:${verse.verse}`,
        `   text:            ${Buffer.byteLength(text, 'utf8')} B`,
        `   transaction:     ${wireBytes} B of 1232 (with ComputeBudget)`,
        `   compute units:   ${detail?.meta?.computeUnitsConsumed ?? '?'}`,
        `   account (rent):  ${account?.data.length ?? '?'} B → ${((account?.lamports ?? 0) / 1e9).toFixed(6)} SOL`,
        `   signature:       ${signature}`,
        '',
      ].join('\n'),
    )
    return pda
  }

  // 1 & 2 — a plain verse and the longest verse, both real registrations.
  await register(address(1, 1, 1), 'Genesis 1:1')
  await register(address(17, 8, 9), 'Esther 8:9 (longest verse)')

  // 3 — duplicate must be refused. The account already exists, so `init` fails.
  process.stdout.write('Attempting to register Genesis 1:1 again (must fail)...\n')
  try {
    const { text, proof } = prover.proofFor(address(1, 1, 1))
    const { blockhash: fresh } = await connection.getLatestBlockhash()
    const duplicate = registerVerseTransaction({
      adopter: wallet.publicKey,
      address: address(1, 1, 1),
      text,
      proof,
      recentBlockhash: fresh,
      computeUnitLimit: 400_000,
    })
    duplicate.sign([wallet])
    const signature = await connection.sendTransaction(duplicate as VersionedTransaction)
    await connection.confirmTransaction(signature, 'confirmed')
    throw new Error(`duplicate registration SUCCEEDED — this must never happen (${signature})`)
  } catch (error) {
    if (String(error).includes('must never happen')) throw error
    process.stdout.write('✅ duplicate refused — the verse address is already taken\n\n')
  }

  process.stdout.write('Smoke test passed — the irreversible path works on devnet.\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
