import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

/**
 * Drizzle client over postgres.js. `prepare: false` keeps the same client valid
 * against a direct local Postgres and the Supabase transaction pooler, which
 * rejects prepared statements — ver ADR
 * docs/decisions/2026-07-22_tooling-de-banco-e-postgres-local.md.
 *
 * The connection string is passed in (never read from the ambient env here), so
 * callers control it and the adapter stays testable — the port isolates the
 * rest of the code from the driver (FD-10).
 */
export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false,
    // Fail-fast instead of hanging: without these a dead/slow Supabase socket
    // would burn the whole Lambda timeout. `connect_timeout` caps the handshake;
    // `idle_timeout` drops idle connections (good through the pooler and between
    // reconcile runs). A server-side `statement_timeout` does NOT go here — the
    // Supabase transaction pooler rejects it as a startup param (same reason as
    // `prepare: false`); it lives on the Supabase role (see the indexer module).
    connect_timeout: 10, // seconds
    idle_timeout: 20, // seconds
  })
  return drizzle(client)
}

export type Database = ReturnType<typeof createDatabase>

/** Reads `DATABASE_URL` from the environment, failing loud if it is absent. */
export function databaseUrlFromEnv(): string {
  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set — copy .env.example to .env or export it')
  }
  return url
}
