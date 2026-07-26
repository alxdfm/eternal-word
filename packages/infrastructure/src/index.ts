// Drizzle client + Supabase adapters. Schema (DB-01), repository and seed
// (DB-02) are added as the S03 data tasks land.
export { createDatabase, databaseUrlFromEnv, type Database } from './db/client.js'
export { createVerseRepository } from './db/verse-repository.js'
export { createVerseReadRepository } from './db/verse-read-repository.js'
export { createAggregateReadRepository } from './db/aggregate-read-repository.js'
export { createChapterTextReader } from './db/chapter-text-reader.js'
export { createHeartbeatStore } from './db/heartbeat-store.js'
export { seed, type SeedCounts } from './db/seed.js'
export { createLogsEventSource } from './chain/logs-event-source.js'
export { createProgramAccountsReader } from './chain/program-accounts-reader.js'
export { parseHeliusWebhook } from './chain/helius-webhook.js'
