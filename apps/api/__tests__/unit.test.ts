import type { VerseReadRepository, VerseRepository, VerseView } from '@eternal-word/application'
import { describe, expect, it } from 'vitest'
import { handleMarkPending } from '../src/web/pending-route.js'
import { RateLimiter } from '../src/web/rate-limit.js'
import { handleReadVerse } from '../src/web/read-verse.js'
import type { VerseDto } from '../src/web/verse-dto.js'

function repoReturning(view: VerseView | null): VerseReadRepository {
  return { findByAddress: async () => view }
}

const registered: VerseView = {
  address: { book: 1, chapter: 1, verse: 1 },
  text: 'In the beginning God created the heavens and the earth.',
  registrable: true,
  status: 'REGISTERED',
  adopter: 'Adopter1111111111111111111111111111111111111',
  transaction: 'Sig111',
  account: 'Acc111',
  slot: 478083892n,
  registeredAt: new Date('2026-07-22T00:00:00.000Z'),
}

describe('handleReadVerse', () => {
  it('returns 200 with the DTO for a registered verse', async () => {
    const res = await handleReadVerse(repoReturning(registered), {
      book: '1',
      chapter: '1',
      verse: '1',
    })
    expect(res.statusCode).toBe(200)
    const dto = JSON.parse(res.body) as VerseDto
    expect(dto.status).toBe('REGISTERED')
    expect(dto.registrable).toBe(true)
    // bigint slot crosses the JSON boundary as a string; timestamp as ISO.
    expect(dto.slot).toBe('478083892')
    expect(dto.registeredAt).toBe('2026-07-22T00:00:00.000Z')
    expect(dto.text).toContain('In the beginning')
  })

  it('marks an omitted position as not registrable', async () => {
    const omitted: VerseView = {
      address: { book: 42, chapter: 17, verse: 36 }, // Luke 17:36 — omitted in the WEB
      text: null,
      registrable: false,
      status: null,
      adopter: null,
      transaction: null,
      account: null,
      slot: null,
      registeredAt: null,
    }
    const res = await handleReadVerse(repoReturning(omitted), {
      book: '42',
      chapter: '17',
      verse: '36',
    })
    expect(res.statusCode).toBe(200)
    const dto = JSON.parse(res.body) as VerseDto
    expect(dto.registrable).toBe(false)
    expect(dto.text).toBeNull()
    expect(dto.status).toBeNull()
  })

  it('returns 404 when the reference is not in the versification', async () => {
    const res = await handleReadVerse(repoReturning(null), {
      book: '1',
      chapter: '150',
      verse: '1',
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects an out-of-range reference with 400', async () => {
    const res = await handleReadVerse(repoReturning(registered), {
      book: '0',
      chapter: '1',
      verse: '1',
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects non-integer params with 400', async () => {
    const res = await handleReadVerse(repoReturning(registered), {
      book: 'x',
      chapter: '1',
      verse: '1',
    })
    expect(res.statusCode).toBe(400)
  })
})

type PendingCall = { book: number; chapter: number; verse: number; transaction: string }

function fakeWriteRepo(calls: PendingCall[]): VerseRepository {
  return {
    recordRegistered: async () => undefined,
    markPending: async (address, transaction) => {
      calls.push({
        book: address.book,
        chapter: address.chapter,
        verse: address.verse,
        transaction,
      })
    },
    failStalePending: async () => [],
    listNonAvailable: async () => [],
    releaseToAvailable: async () => undefined,
  }
}

describe('handleMarkPending', () => {
  it('marks a valid verse pending and calls the repo (200)', async () => {
    const calls: PendingCall[] = []
    const res = await handleMarkPending(
      fakeWriteRepo(calls),
      JSON.stringify({ book: 1, chapter: 1, verse: 1, transaction: 'Sig1' }),
    )
    expect(res.statusCode).toBe(200)
    expect(calls).toEqual([{ book: 1, chapter: 1, verse: 1, transaction: 'Sig1' }])
  })

  it('rejects a missing transaction with 400', async () => {
    const res = await handleMarkPending(
      fakeWriteRepo([]),
      JSON.stringify({ book: 1, chapter: 1, verse: 1 }),
    )
    expect(res.statusCode).toBe(400)
  })

  it('rejects invalid JSON with 400', async () => {
    expect((await handleMarkPending(fakeWriteRepo([]), '{ not json')).statusCode).toBe(400)
  })

  it('rejects an out-of-range reference with 400', async () => {
    const res = await handleMarkPending(
      fakeWriteRepo([]),
      JSON.stringify({ book: 0, chapter: 1, verse: 1, transaction: 'S' }),
    )
    expect(res.statusCode).toBe(400)
  })
})

describe('RateLimiter (HD-05)', () => {
  it('allows up to capacity, then denies with a retry-after', () => {
    const now = 1_000
    const limiter = new RateLimiter({ capacity: 3, refillPerSec: 1, now: () => now })
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(true)
    const denied = limiter.take('ip')
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterMs).toBeGreaterThan(0)
  })

  it('refills over time', () => {
    let now = 0
    const limiter = new RateLimiter({ capacity: 2, refillPerSec: 1, now: () => now })
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(false)
    now += 1_000 // one token refilled
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(false)
  })

  it('keeps separate buckets per key', () => {
    const now = 0
    const limiter = new RateLimiter({ capacity: 1, refillPerSec: 1, now: () => now })
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(false)
    // b is untouched.
    expect(limiter.take('b').allowed).toBe(true)
  })

  it('prunes idle buckets', () => {
    let now = 0
    const limiter = new RateLimiter({ capacity: 1, refillPerSec: 1, now: () => now })
    limiter.take('a')
    limiter.take('b')
    expect(limiter.size()).toBe(2)
    now += 60_000
    limiter.prune(30_000)
    expect(limiter.size()).toBe(0)
  })
})
