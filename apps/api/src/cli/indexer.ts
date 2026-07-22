// Runs the indexer against devnet + the local Postgres.
//   pnpm indexer:dev
// Camada 1 uses logsSubscribe on the public devnet RPC — no provider needed
// (ADR 2026-07-21_fonte-de-eventos-do-indexer.md). Helius plugs in at IX-05.
import {
  createDatabase,
  createHeartbeatStore,
  createLogsEventSource,
  createProgramAccountsReader,
  createVerseRepository,
  databaseUrlFromEnv,
} from '@eternal-word/infrastructure'
import { Connection } from '@solana/web3.js'
import { runIndexer } from '../indexer/run.js'

if (process.env.DATABASE_URL === undefined) {
  try {
    process.loadEnvFile('../../.env')
  } catch {
    // rely on the ambient environment
  }
}

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const connection = new Connection(rpcUrl, 'confirmed')
const db = createDatabase(databaseUrlFromEnv())

const indexer = await runIndexer({
  connection,
  repo: createVerseRepository(db),
  events: createLogsEventSource(connection),
  chain: createProgramAccountsReader(connection),
  heartbeat: createHeartbeatStore(db),
  reconcileIntervalMs: Number(process.env.INDEXER_RECONCILE_MS ?? 30_000),
  pendingTtlMs: Number(process.env.INDEXER_PENDING_TTL_MS ?? 120_000),
  thresholds: {
    maxLagSlots: BigInt(process.env.INDEXER_MAX_LAG_SLOTS ?? 300),
    maxSilenceMs: Number(process.env.INDEXER_MAX_SILENCE_MS ?? 90_000),
  },
})

process.stdout.write(`indexer running against ${rpcUrl}\n`)

const shutdown = async (): Promise<void> => {
  await indexer.stop()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
