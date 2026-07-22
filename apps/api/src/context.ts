import {
  createDatabase,
  createHeartbeatStore,
  createProgramAccountsReader,
  createVerseRepository,
  databaseUrlFromEnv,
} from '@eternal-word/infrastructure'
import { Connection } from '@solana/web3.js'

function build() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    'confirmed',
  )
  const db = createDatabase(databaseUrlFromEnv())
  return {
    connection,
    repo: createVerseRepository(db),
    chain: createProgramAccountsReader(connection),
    heartbeat: createHeartbeatStore(db),
  }
}

export type AppContext = ReturnType<typeof build>

let cached: AppContext | undefined

/** Built once per warm Lambda container and reused across invocations — a new
 * Postgres client per request would exhaust the pool. */
export function context(): AppContext {
  cached ??= build()
  return cached
}
