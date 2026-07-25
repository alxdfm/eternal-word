import { describe, expect, it } from 'vitest'
import { createDatabase } from '../src/db/client.js'
import { createVerseReadRepository } from '../src/db/verse-read-repository.js'

const DATABASE_URL = process.env.DATABASE_URL

// Runs only when a seeded Postgres is reachable (pnpm db:up && db:migrate &&
// db:seed). Skips cleanly in CI, which has no DB — the S03/S04 smoke covers the
// live path. Kept as a local check that the read query joins correctly.
describe.skipIf(!DATABASE_URL)('createVerseReadRepository (Postgres)', () => {
  it('returns the canonical text for Genesis 1:1', async () => {
    const repo = createVerseReadRepository(createDatabase(DATABASE_URL as string))
    const view = await repo.findByAddress({ book: 1, chapter: 1, verse: 1 })
    expect(view).not.toBeNull()
    expect(view?.registrable).toBe(true)
    expect(view?.text).toBeTruthy()
  })

  it('marks Luke 17:36 (omitted in the WEB) as not registrable', async () => {
    const repo = createVerseReadRepository(createDatabase(DATABASE_URL as string))
    const view = await repo.findByAddress({ book: 42, chapter: 17, verse: 36 })
    expect(view).not.toBeNull()
    expect(view?.registrable).toBe(false)
    expect(view?.text).toBeNull()
  })

  it('returns null for a reference not in the versification', async () => {
    const repo = createVerseReadRepository(createDatabase(DATABASE_URL as string))
    const view = await repo.findByAddress({ book: 1, chapter: 150, verse: 1 })
    expect(view).toBeNull()
  })
})
