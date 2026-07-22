import { defineConfig } from 'drizzle-kit'

// Local dev convenience: load the repo-root .env (gitignored) when DATABASE_URL
// is not already set (CI/Lambda provide it directly). This file runs with CWD
// at the package dir via `pnpm --filter`, so `../../.env` is the repo root.
if (process.env.DATABASE_URL === undefined) {
  try {
    process.loadEnvFile('../../.env')
  } catch {
    // no .env present — the check below reports the missing variable
  }
}

const url = process.env.DATABASE_URL
if (url === undefined || url === '') {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env or export it')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
