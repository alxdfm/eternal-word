import { describe, expect, it } from 'vitest'
import {
  BOOK_COUNT,
  TESTAMENT,
  VERSE_STATUS,
  canTransition,
  compareVerseAddress,
  createVerseAddress,
  isTerminal,
  testamentOf,
  verseAddressEquals,
  verseAddressKey,
} from '../src/index.js'

describe('createVerseAddress', () => {
  it('accepts the first and last verse of the canon', () => {
    expect(createVerseAddress(1, 1, 1).ok).toBe(true)
    expect(createVerseAddress(66, 22, 21).ok).toBe(true)
  })

  it('rejects book indexes outside 1-66', () => {
    for (const book of [0, -1, 67, 1.5]) {
      const result = createVerseAddress(book, 1, 1)
      expect(result.ok, `book ${book} should be rejected`).toBe(false)
    }
  })

  it('rejects non-positive or fractional chapters and verses', () => {
    expect(createVerseAddress(1, 0, 1).ok).toBe(false)
    expect(createVerseAddress(1, 1, 0).ok).toBe(false)
    expect(createVerseAddress(1, 1.5, 1).ok).toBe(false)
    expect(createVerseAddress(1, 1, Number.NaN).ok).toBe(false)
  })

  it('rejects values beyond the largest chapter and verse in the canon', () => {
    expect(createVerseAddress(19, 151, 1).ok).toBe(false)
    expect(createVerseAddress(19, 119, 177).ok).toBe(false)
  })

  it('reports what went wrong in English', () => {
    const result = createVerseAddress(99, 1, 1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('book index out of range')
  })
})

describe('verse address helpers', () => {
  it('compares by book, then chapter, then verse', () => {
    const genesis11 = { book: 1, chapter: 1, verse: 1 }
    const genesis12 = { book: 1, chapter: 1, verse: 2 }
    const genesis21 = { book: 1, chapter: 2, verse: 1 }
    const exodus11 = { book: 2, chapter: 1, verse: 1 }

    expect(compareVerseAddress(genesis11, genesis12)).toBeLessThan(0)
    expect(compareVerseAddress(genesis12, genesis21)).toBeLessThan(0)
    expect(compareVerseAddress(genesis21, exodus11)).toBeLessThan(0)
    expect(compareVerseAddress(genesis11, genesis11)).toBe(0)
  })

  it('treats equal addresses as equal and distinct ones as distinct', () => {
    expect(
      verseAddressEquals({ book: 1, chapter: 1, verse: 1 }, { book: 1, chapter: 1, verse: 1 }),
    ).toBe(true)
    expect(
      verseAddressEquals({ book: 1, chapter: 1, verse: 1 }, { book: 1, chapter: 1, verse: 2 }),
    ).toBe(false)
  })

  it('produces distinct keys for distinct addresses', () => {
    const keys = new Set([
      verseAddressKey({ book: 1, chapter: 11, verse: 1 }),
      verseAddressKey({ book: 1, chapter: 1, verse: 11 }),
      verseAddressKey({ book: 11, chapter: 1, verse: 1 }),
    ])
    expect(keys.size).toBe(3)
  })
})

describe('testaments', () => {
  it('splits the canon at Matthew', () => {
    expect(testamentOf(39)).toBe(TESTAMENT.OLD)
    expect(testamentOf(40)).toBe(TESTAMENT.NEW)
    expect(testamentOf(BOOK_COUNT)).toBe(TESTAMENT.NEW)
  })
})

describe('verse status transitions', () => {
  it('follows the happy path through the site', () => {
    expect(canTransition(VERSE_STATUS.AVAILABLE, VERSE_STATUS.PENDING)).toBe(true)
    expect(canTransition(VERSE_STATUS.PENDING, VERSE_STATUS.REGISTERED)).toBe(true)
  })

  it('allows a registration observed straight from the program', () => {
    // Permissionless protocol: the indexer may see an account appear for a
    // verse the site never marked as pending.
    expect(canTransition(VERSE_STATUS.AVAILABLE, VERSE_STATUS.REGISTERED)).toBe(true)
  })

  it('returns a failed registration to the pool', () => {
    expect(canTransition(VERSE_STATUS.PENDING, VERSE_STATUS.FAILED)).toBe(true)
    expect(canTransition(VERSE_STATUS.FAILED, VERSE_STATUS.AVAILABLE)).toBe(true)
  })

  it('never walks back a registration', () => {
    expect(isTerminal(VERSE_STATUS.REGISTERED)).toBe(true)
    for (const status of Object.values(VERSE_STATUS)) {
      expect(
        canTransition(VERSE_STATUS.REGISTERED, status),
        `REGISTERED must not move to ${status}`,
      ).toBe(false)
    }
  })

  it('does not skip from available to failed', () => {
    expect(canTransition(VERSE_STATUS.AVAILABLE, VERSE_STATUS.FAILED)).toBe(false)
  })
})
