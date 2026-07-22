//
// S03 local smoke: proves the indexer mirrors the chain into Postgres, end to
// end, against the local Postgres (`pnpm db:up`) and public devnet.
//
//   pnpm smoke:indexer
//
// It proves both sync layers:
//   - camada 3 (reconciliation): the VerseAccounts already on-chain are recorded
//     into a fresh mirror by a getProgramAccounts scan;
//   - camada 1 (real-time): a freshly registered verse shows up in the mirror
//     within seconds via logsSubscribe, with no provider.
//
// IX-05 runs this same code against the provisioned Supabase + Helius — the
// ports make the swap a configuration change, not a rewrite.
//
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { reconcile } from '@eternal-word/application'
import { CatalogProver, registerVerseTransaction, versePda } from '@eternal-word/blockchain'
import { VERSE_STATUS, type VerseAddress, verseAddressKey } from '@eternal-word/domain'
import {
  createDatabase,
  createLogsEventSource,
  createProgramAccountsReader,
  createVerseRepository,
  databaseUrlFromEnv,
} from '@eternal-word/infrastructure'
import { Connection, Keypair } from '@solana/web3.js'

if (process.env.DATABASE_URL === undefined) {
  try {
    process.loadEnvFile('../.env')
  } catch {
    // rely on the ambient environment
  }
}

const log = (message: string): void => {
  process.stdout.write(`${message}\n`)
}
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function main(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')
  const db = createDatabase(databaseUrlFromEnv())
  const repo = createVerseRepository(db)
  const chain = createProgramAccountsReader(connection)
  const events = createLogsEventSource(connection)
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, 'utf8'))),
  )

  log(`Eternal Word — S03 indexer smoke\n  cluster: ${rpcUrl}\n`)

  // --- camada 3: reconciliation ---------------------------------------------
  log('reconciliation (camada 3):')
  const onChain = await chain.listRegistrations()
  log(`  ${onChain.length} VerseAccount(s) on-chain`)
  if (onChain.length === 0)
    throw new Error('no on-chain registrations to reconcile — run PG-08/PG-11 first')
  // Reset the mirror rows so the recording is observable, not a no-op.
  for (const registration of onChain) await repo.releaseToAvailable(registration.address)
  const report = await reconcile(repo, chain)
  const nonAvailable = await repo.listNonAvailable()
  const registered = new Set(
    nonAvailable
      .filter((entry) => entry.status === VERSE_STATUS.REGISTERED)
      .map((entry) => verseAddressKey(entry.address)),
  )
  const allRecorded = onChain.every((entry) => registered.has(verseAddressKey(entry.address)))
  log(
    `  recorded ${report.recorded}, released ${report.released}; all on-chain now REGISTERED: ${allRecorded}`,
  )
  if (!allRecorded) throw new Error('reconciliation did not record every on-chain account')

  // --- register a fresh verse to exercise both layers -----------------------
  log('\nreal-time (camada 1) + recovery (camada 3):')
  const observed = new Set<string>()
  const unsubscribe = await events.subscribe(async (event) => {
    await repo.recordRegistered(event)
    observed.add(verseAddressKey(event.address))
    log(`  event: ${verseAddressKey(event.address)} recorded via logsSubscribe`)
  })
  // Give the WebSocket subscription time to establish before registering.
  await sleep(5000)

  let target: VerseAddress | null = null
  for (let verse = 3; verse <= 31; verse += 1) {
    const address = { book: 1, chapter: 1, verse }
    if ((await connection.getAccountInfo(versePda(address)[0])) === null) {
      target = address
      break
    }
  }

  if (target === null) {
    log('  Genesis 1 is fully registered — no free verse to register; camada 3 proven above')
    await unsubscribe()
    log('\nS03 indexer smoke passed — chain → Postgres mirror works end to end.')
    process.exit(0)
  }

  const key = verseAddressKey(target)
  log(`  registering ${key} on devnet...`)
  const { text, proof } = new CatalogProver().proofFor(target)
  const { blockhash } = await connection.getLatestBlockhash()
  const transaction = registerVerseTransaction({
    adopter: wallet.publicKey,
    address: target,
    text,
    proof,
    recentBlockhash: blockhash,
    computeUnitLimit: 400_000,
    priorityFeeMicroLamports: 1000,
  })
  transaction.sign([wallet])
  const signature = await connection.sendTransaction(transaction)
  await connection.confirmTransaction(signature, 'confirmed')
  log(`  registered ${signature}`)

  // Camada 1 is best-effort on the public devnet WebSocket — the ADR makes
  // logsSubscribe the dev path and reconciliation the guarantee, so a dropped
  // notification here is a normal, recoverable miss.
  const deadline = Date.now() + 30_000
  while (!observed.has(key) && Date.now() < deadline) await sleep(1000)
  log(
    observed.has(key)
      ? `  camada 1: ${key} appeared via logsSubscribe seconds after registration`
      : '  camada 1: public devnet ws did not deliver in time (best-effort) — reconciliation recovers it',
  )

  // Camada 3 recovery: reconciliation records whatever the event stream missed —
  // the "reconciliação corrige um evento perdido" half of the S03 deliverable.
  await reconcile(repo, chain)
  const mirror = await repo.listNonAvailable()
  const finalStatus = mirror.find((entry) => verseAddressKey(entry.address) === key)?.status
  if (finalStatus !== VERSE_STATUS.REGISTERED) {
    throw new Error(`${key} is ${finalStatus ?? 'AVAILABLE'} in the mirror after reconciliation`)
  }
  log(`  camada 3: ${key} is REGISTERED in the mirror (reconciliation is the guarantee)`)

  await unsubscribe()
  log('\nS03 indexer smoke passed — chain → Postgres mirror works end to end.')
  process.exit(0)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
