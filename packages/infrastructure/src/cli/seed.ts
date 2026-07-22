// Seeds the catalog tables and the AVAILABLE positions from the CanonicalText.
//   pnpm db:seed
// Idempotent — safe to re-run; never overwrites indexer-set status.
import { createDatabase, databaseUrlFromEnv } from '../db/client.js'
import { seed } from '../db/seed.js'

if (process.env.DATABASE_URL === undefined) {
  try {
    process.loadEnvFile('../../.env')
  } catch {
    // no .env — rely on the ambient environment
  }
}

const db = createDatabase(databaseUrlFromEnv())
const counts = await seed(db)
console.log('seed complete:', counts)
process.exit(0)
