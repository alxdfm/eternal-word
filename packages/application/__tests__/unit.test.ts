import {
  buildCanonicalTree,
  listRegistrableVerses,
  loadCanonicalBooks,
  proofForAddress,
  toHex,
} from '@eternal-word/catalog'
import {
  VERSE_STATUS,
  type VerseAddress,
  type VerseStatus,
  verseAddressKey,
} from '@eternal-word/domain'
import { describe, expect, it } from 'vitest'
import {
  type AdopterSummary,
  type AggregateReadRepository,
  type BookCoverage,
  type BookProgress,
  type ChainReader,
  type ChapterProgress,
  type ChapterTextReader,
  type DashboardAggregates,
  type DayCount,
  type HeartbeatState,
  type ListFilter,
  type MirrorEntry,
  type Paginated,
  type SearchHit,
  type SearchRepository,
  type VerseListItem,
  type VerseRegistered,
  type VerseRepository,
  buildRegistrationProof,
  estimateSol,
  evaluateHeartbeat,
  getAdopterProfile,
  getChapterProgress,
  listVerses,
  markPending,
  markPendingRequest,
  reconcile,
  recordRegistered,
  searchVerses,
  toCumulativeTrend,
} from '../src/index.js'

const address = (book: number, chapter: number, verse: number): VerseAddress => ({
  book,
  chapter,
  verse,
})

const event = (a: VerseAddress, slot = 1n): VerseRegistered => ({
  address: a,
  adopter: 'Wallet1111',
  account: 'Account1111',
  transaction: 'Sig1111',
  slot,
  registeredAt: new Date('2026-07-22T00:00:00Z'),
})

/** In-memory mirror: only non-AVAILABLE rows are stored; a missing key reads as
 * AVAILABLE, which is exactly how `releaseToAvailable` behaves. */
class InMemoryRepo implements VerseRepository {
  readonly rows = new Map<string, { address: VerseAddress; status: VerseStatus }>()

  set(a: VerseAddress, status: VerseStatus): void {
    this.rows.set(verseAddressKey(a), { address: a, status })
  }

  async recordRegistered(e: VerseRegistered): Promise<void> {
    this.set(e.address, VERSE_STATUS.REGISTERED)
  }
  async markPending(a: VerseAddress): Promise<void> {
    this.set(a, VERSE_STATUS.PENDING)
  }
  async failStalePending(): Promise<VerseAddress[]> {
    return []
  }
  async listNonAvailable(): Promise<MirrorEntry[]> {
    return [...this.rows.values()].map((row) => ({ address: row.address, status: row.status }))
  }
  async releaseToAvailable(a: VerseAddress): Promise<void> {
    this.rows.delete(verseAddressKey(a))
  }
}

const chainOf = (events: VerseRegistered[]): ChainReader => ({
  listRegistrations: async () => events,
})

describe('reconcile', () => {
  it('records on-chain registrations the mirror is missing', async () => {
    const repo = new InMemoryRepo()
    const report = await reconcile(repo, chainOf([event(address(1, 1, 1))]))
    expect(report).toEqual({ recorded: 1, released: 0 })
    expect(repo.rows.get('1:1:1')?.status).toBe(VERSE_STATUS.REGISTERED)
  })

  it('releases a REGISTERED row the chain no longer backs (reorg)', async () => {
    const repo = new InMemoryRepo()
    repo.set(address(1, 1, 1), VERSE_STATUS.REGISTERED)
    const report = await reconcile(repo, chainOf([]))
    expect(report.released).toBe(1)
    expect(repo.rows.has('1:1:1')).toBe(false)
  })

  it('releases a FAILED attempt not on-chain', async () => {
    const repo = new InMemoryRepo()
    repo.set(address(1, 1, 2), VERSE_STATUS.FAILED)
    expect((await reconcile(repo, chainOf([]))).released).toBe(1)
  })

  it('leaves a PENDING not yet on-chain for expiry to age out', async () => {
    const repo = new InMemoryRepo()
    repo.set(address(1, 1, 3), VERSE_STATUS.PENDING)
    const report = await reconcile(repo, chainOf([]))
    expect(report.released).toBe(0)
    expect(repo.rows.get('1:1:3')?.status).toBe(VERSE_STATUS.PENDING)
  })
})

describe('address validation', () => {
  it('rejects a registration with an out-of-range book', async () => {
    await expect(recordRegistered(new InMemoryRepo(), event(address(99, 1, 1)))).rejects.toThrow()
  })

  it('rejects marking an out-of-range address pending', async () => {
    await expect(markPending(new InMemoryRepo(), address(0, 1, 1), 'Sig')).rejects.toThrow()
  })
})

describe('evaluateHeartbeat', () => {
  const thresholds = { maxLagSlots: 100n, maxSilenceMs: 60_000 }
  const now = new Date('2026-07-22T12:00:00Z')
  const beat = (slot: bigint, agoMs: number): HeartbeatState => ({
    lastProcessedSlot: slot,
    updatedAt: new Date(now.getTime() - agoMs),
  })

  it('is unhealthy when the indexer has never beaten', () => {
    expect(evaluateHeartbeat(null, 1000n, now, thresholds).healthy).toBe(false)
  })

  it('is unhealthy when it stopped beating (R4)', () => {
    const health = evaluateHeartbeat(beat(1000n, 120_000), 1000n, now, thresholds)
    expect(health.healthy).toBe(false)
    expect(health.reason).toMatch(/no heartbeat/)
  })

  it('is unhealthy when it fell behind the chain', () => {
    const health = evaluateHeartbeat(beat(1000n, 1_000), 2000n, now, thresholds)
    expect(health.healthy).toBe(false)
    expect(health.lagSlots).toBe(1000n)
  })

  it('is healthy when recent and caught up', () => {
    expect(evaluateHeartbeat(beat(1990n, 1_000), 2000n, now, thresholds).healthy).toBe(true)
  })
})

describe('buildRegistrationProof', () => {
  const genesis1 = listRegistrableVerses(loadCanonicalBooks()).filter(
    (v) => v.address.book === 1 && v.address.chapter === 1,
  )

  const reader: ChapterTextReader = {
    listChapter: async (book, chapter) =>
      book === 1 && chapter === 1
        ? genesis1.map((v) => ({ verse: v.address.verse, text: v.text }))
        : [],
  }

  it('reproduces the chapter proof the catalog builds for Genesis 1:1', async () => {
    const reference = proofForAddress(buildCanonicalTree(genesis1), {
      book: 1,
      chapter: 1,
      verse: 1,
    }).map(toHex)
    const result = await buildRegistrationProof(reader, 1, 1, 1)
    expect(result).toEqual({ kind: 'ok', text: genesis1[0]?.text, proof: reference })
  })

  it('marks an absent verse in the chapter as not registrable', async () => {
    expect(await buildRegistrationProof(reader, 1, 1, 99)).toEqual({ kind: 'not-registrable' })
  })

  it('rejects an out-of-range reference', async () => {
    expect((await buildRegistrationProof(reader, 0, 1, 1)).kind).toBe('invalid')
  })

  it('reproduces the proof through a numbering gap (Acts 8:38, verse 37 omitted)', async () => {
    const acts8 = listRegistrableVerses(loadCanonicalBooks()).filter(
      (v) => v.address.book === 44 && v.address.chapter === 8,
    )
    const actsReader: ChapterTextReader = {
      listChapter: async () => acts8.map((v) => ({ verse: v.address.verse, text: v.text })),
    }
    const expected = proofForAddress(buildCanonicalTree(acts8), {
      book: 44,
      chapter: 8,
      verse: 38,
    }).map(toHex)
    const target = acts8.find((v) => v.address.verse === 38)
    expect(await buildRegistrationProof(actsReader, 44, 8, 38)).toEqual({
      kind: 'ok',
      text: target?.text,
      proof: expected,
    })
  })
})

describe('markPendingRequest', () => {
  it('marks an available verse pending', async () => {
    const repo = new InMemoryRepo()
    expect(await markPendingRequest(repo, 1, 1, 1, 'Sig')).toEqual({ kind: 'ok' })
    expect(repo.rows.get('1:1:1')?.status).toBe(VERSE_STATUS.PENDING)
  })

  it('rejects an out-of-range reference without touching the repo', async () => {
    const repo = new InMemoryRepo()
    expect((await markPendingRequest(repo, 0, 1, 1, 'Sig')).kind).toBe('invalid')
    expect(repo.rows.size).toBe(0)
  })
})

/** Records the offset/limit the use case passes down, and returns canned data. */
class StubAggregateRepo implements AggregateReadRepository {
  offset = -1
  limit = -1
  async dashboardAggregates(): Promise<DashboardAggregates> {
    return {
      registered: 0,
      pending: 0,
      available: 0,
      failed: 0,
      total: 0,
      uniqueAdopters: 0,
      booksBegun: 0,
      chaptersBegun: 0,
      registeredTextBytes: 0,
    }
  }
  async registrationsByDay(): Promise<readonly DayCount[]> {
    return []
  }
  async listVerses(
    _f: ListFilter,
    offset: number,
    limit: number,
  ): Promise<Paginated<VerseListItem>> {
    this.offset = offset
    this.limit = limit
    return { items: [], page: 1, pageSize: limit, total: 0 }
  }
  async bookProgress(): Promise<readonly BookProgress[]> {
    return []
  }
  async chapterProgress(): Promise<readonly ChapterProgress[]> {
    return [{ chapter: 1, registered: 1, registrable: 31 }]
  }
  async adopterSummary(): Promise<AdopterSummary> {
    return { verses: 0, books: 0, registeredTextBytes: 0 }
  }
  async adopterVerses(
    _adopter: string,
    offset: number,
    limit: number,
  ): Promise<Paginated<VerseListItem>> {
    this.offset = offset
    this.limit = limit
    return { items: [], page: 1, pageSize: limit, total: 0 }
  }
  async adopterCoverage(): Promise<readonly BookCoverage[]> {
    return []
  }
}

describe('estimateSol', () => {
  it('reproduces the measured devnet rent for Genesis 1:1 (56 B text)', () => {
    // 6960 × (56 + 58 + 128) + 5000 fee = 1,689,320 lamports
    expect(estimateSol(1, 56)).toBeCloseTo(0.00168932, 8)
  })

  it('reproduces the measured devnet rent for Esther 8:9 (493 B text)', () => {
    expect(estimateSol(1, 493)).toBeCloseTo(0.00473084, 8)
  })

  it('is zero for no registrations', () => {
    expect(estimateSol(0, 0)).toBe(0)
  })
})

describe('toCumulativeTrend', () => {
  it('accumulates a per-day series into a running total', () => {
    expect(
      toCumulativeTrend([
        { day: '2026-07-24', count: 2 },
        { day: '2026-07-25', count: 3 },
        { day: '2026-07-26', count: 1 },
      ]),
    ).toEqual([
      { day: '2026-07-24', cumulative: 2 },
      { day: '2026-07-25', cumulative: 5 },
      { day: '2026-07-26', cumulative: 6 },
    ])
  })
})

describe('listVerses pagination', () => {
  it('clamps pageSize above the max and page below 1', async () => {
    const repo = new StubAggregateRepo()
    await listVerses(repo, 'recent', 0, 999)
    expect(repo.limit).toBe(50)
    expect(repo.offset).toBe(0)
  })

  it('computes the offset from a valid page', async () => {
    const repo = new StubAggregateRepo()
    await listVerses(repo, 'registered', 3, 20)
    expect(repo.offset).toBe(40)
    expect(repo.limit).toBe(20)
  })
})

describe('getChapterProgress', () => {
  it('rejects a book index out of range', async () => {
    expect((await getChapterProgress(new StubAggregateRepo(), 67)).kind).toBe('invalid')
  })

  it('returns the chapters for a valid book', async () => {
    const result = await getChapterProgress(new StubAggregateRepo(), 43)
    expect(result.kind).toBe('ok')
  })
})

describe('searchVerses', () => {
  class StubSearchRepo implements SearchRepository {
    calls: Array<{ query: string; limit: number }> = []
    async searchByText(query: string, limit: number): Promise<readonly SearchHit[]> {
      this.calls.push({ query, limit })
      return []
    }
  }

  it('skips the DB for an empty or whitespace query', async () => {
    const repo = new StubSearchRepo()
    expect(await searchVerses(repo, '   ')).toEqual([])
    expect(repo.calls).toHaveLength(0)
  })

  it('trims the query and clamps the limit', async () => {
    const repo = new StubSearchRepo()
    await searchVerses(repo, '  light  ', 999)
    expect(repo.calls[0]).toEqual({ query: 'light', limit: 50 })
  })
})

describe('getAdopterProfile', () => {
  it('returns an empty profile for an unknown wallet (no error)', async () => {
    const repo = new StubAggregateRepo()
    const profile = await getAdopterProfile(repo, 'Nobody11111', 1, 20)
    expect(profile.verses).toBe(0)
    expect(profile.estimatedSol).toBe(0)
    expect(profile.coverage).toEqual([])
    expect(profile.page.items).toEqual([])
  })

  it('clamps the verse-page size', async () => {
    const repo = new StubAggregateRepo()
    await getAdopterProfile(repo, 'Wallet1', 2, 999)
    expect(repo.limit).toBe(50)
    expect(repo.offset).toBe(50)
  })
})
