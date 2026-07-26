import type { VerseRegistered } from '@eternal-word/application'
import type { VerseAddress } from '@eternal-word/domain'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAggregateReadRepository } from '../src/db/aggregate-read-repository.js'
import { createDatabase } from '../src/db/client.js'
import { verses } from '../src/db/schema.js'
import { createVerseReadRepository } from '../src/db/verse-read-repository.js'
import { createVerseRepository } from '../src/db/verse-repository.js'

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

// The local mirror may already carry registrations from earlier smoke runs, so
// these check the aggregates by *delta*: snapshot the fixture rows, release them
// to AVAILABLE, capture a baseline, apply a known fixture, and assert the change.
// afterAll restores the original rows exactly — non-destructive and re-runnable.
// CI has no DB and skips.
describe.skipIf(!DATABASE_URL)('createAggregateReadRepository (Postgres)', () => {
  const db = createDatabase(DATABASE_URL as string)
  const write = createVerseRepository(db)
  const repo = createAggregateReadRepository(db)

  type VerseRow = typeof verses.$inferSelect
  const ADOPTER = 'TESTAdopterEX02aaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const johnAddr: VerseAddress = { book: 43, chapter: 3, verse: 16 }
  const psalmAddr: VerseAddress = { book: 19, chapter: 23, verse: 1 }
  const pendingAddr: VerseAddress = { book: 45, chapter: 8, verse: 28 }
  const fixture = [johnAddr, psalmAddr, pendingAddr]

  const where = (a: VerseAddress) =>
    and(eq(verses.book, a.book), eq(verses.chapter, a.chapter), eq(verses.verse, a.verse))

  const snapshots: VerseRow[] = []
  let baseline: Awaited<ReturnType<typeof repo.dashboardAggregates>>
  let baselineJohnChapter3 = 0

  beforeAll(async () => {
    for (const a of fixture) {
      const [row] = await db.select().from(verses).where(where(a))
      if (row !== undefined) snapshots.push(row)
      await write.releaseToAvailable(a)
    }
    baseline = await repo.dashboardAggregates()
    baselineJohnChapter3 =
      (await repo.chapterProgress(43)).find((c) => c.chapter === 3)?.registered ?? 0

    await write.recordRegistered({
      address: johnAddr,
      adopter: ADOPTER,
      transaction: 'txJohnEX02',
      account: 'accJohnEX02',
      slot: 100n,
      registeredAt: new Date('2026-07-25T22:19:24Z'),
    } satisfies VerseRegistered)
    await write.recordRegistered({
      address: psalmAddr,
      adopter: ADOPTER,
      transaction: 'txPsalmEX02',
      account: 'accPsalmEX02',
      slot: 90n,
      registeredAt: new Date('2026-07-24T10:00:00Z'),
    } satisfies VerseRegistered)
    await write.markPending(pendingAddr, 'txPendingEX02')
  })

  afterAll(async () => {
    for (const row of snapshots) {
      await db
        .update(verses)
        .set({
          status: row.status,
          adopter: row.adopter,
          transaction: row.transaction,
          account: row.account,
          slot: row.slot,
          registeredAt: row.registeredAt,
          updatedAt: row.updatedAt,
        })
        .where(where({ book: row.book, chapter: row.chapter, verse: row.verse }))
    }
  })

  it('moves the status counts by exactly the fixture', async () => {
    const agg = await repo.dashboardAggregates()
    expect(agg.registered - baseline.registered).toBe(2)
    expect(agg.pending - baseline.pending).toBe(1)
    expect(agg.available - baseline.available).toBe(-3)
    expect(agg.total).toBe(31098)
    expect(agg.registeredTextBytes).toBeGreaterThan(baseline.registeredTextBytes)
  })

  it('lists the fixture verses in canonical order, paginated', async () => {
    const page = await repo.listVerses('registered', 0, 50)
    const mine = page.items.filter((i) => i.adopter === ADOPTER)
    // Psalm 19:23 sorts before John 43:3 by book index.
    expect(mine.map((i) => `${i.book}:${i.chapter}:${i.verse}`)).toEqual(['19:23:1', '43:3:16'])
    expect(mine[0]?.text).toBeTruthy()
  })

  it('reports 66 books and lifts John chapter 3 by one', async () => {
    const books = await repo.bookProgress()
    expect(books).toHaveLength(66)
    // John carries none of the five omitted positions, so registrable is a plain
    // verse count and the denominator is unaffected by them.
    expect(books.find((b) => b.book === 43)?.registrable).toBeGreaterThan(0)

    const chapter3 = (await repo.chapterProgress(43)).find((c) => c.chapter === 3)
    expect((chapter3?.registered ?? 0) - baselineJohnChapter3).toBe(1)
  })

  it('adds the fixture registrations to the daily series', async () => {
    const days = await repo.registrationsByDay()
    const total = days.reduce((sum, d) => sum + d.count, 0)
    expect(total - baseline.registered).toBe(2)
  })
})
