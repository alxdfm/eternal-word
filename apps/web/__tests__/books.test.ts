import { BOOKS, EXPECTED_OMITTED } from '@eternal-word/catalog'
import { describe, expect, it } from 'vitest'
import en from '../messages/en.json'
import { BOOK_NUMBERS, OMITTED_POSITIONS, omittedAt } from '../src/lib/books'

const books = en.books as Record<string, { name: string; abbr: string }>

// The UI's book names are a translatable projection of the canonical catalog.
// This guard fails the build if they ever drift — the names must stay the
// canon's, only the language may change (pt-BR in S06).
describe('book labels mirror the catalog', () => {
  it('has exactly the 66 canonical books', () => {
    expect(Object.keys(books)).toHaveLength(BOOKS.length)
    expect(BOOK_NUMBERS).toHaveLength(66)
  })

  it('matches every name and abbreviation to the catalog', () => {
    for (const book of BOOKS) {
      const entry = books[String(book.book)]
      expect(entry, `missing book ${book.book}`).toBeDefined()
      expect(entry?.name).toBe(book.name)
      expect(entry?.abbr).toBe(book.abbreviation)
    }
  })
})

// The five omitted positions must match the canon exactly; the *kind* is UI
// knowledge layered on top (which note to show).
describe('omitted positions', () => {
  const key = (p: { book: number; chapter: number; verse: number }) =>
    `${p.book}:${p.chapter}:${p.verse}`

  it('covers exactly the catalog EXPECTED_OMITTED set', () => {
    const ours = OMITTED_POSITIONS.map(key).sort()
    const canon = EXPECTED_OMITTED.map(key).sort()
    expect(ours).toEqual(canon)
  })

  it('classifies Romans 16:25 as relocated to Romans 14:24-26', () => {
    const rom = omittedAt(45, 16, 25)
    expect(rom?.kind).toBe('relocated')
    expect(rom?.pointer).toEqual({ book: 45, chapter: 14, verseStart: 24, verseEnd: 26 })
  })

  it('classifies the other four as absent variants with a numbering gap', () => {
    for (const p of OMITTED_POSITIONS.filter((x) => x.kind === 'absent')) {
      expect(p.prevVerse).toBe(p.verse - 1)
      expect(p.nextVerse).toBe(p.verse + 1)
      expect(p.pointer).toBeUndefined()
    }
    // Acts 8:37 reads 8:36 → 8:38.
    expect(omittedAt(44, 8, 37)?.prevVerse).toBe(36)
    expect(omittedAt(44, 8, 37)?.nextVerse).toBe(38)
  })

  it('returns undefined for a normal, registrable position', () => {
    expect(omittedAt(43, 3, 16)).toBeUndefined()
  })
})
