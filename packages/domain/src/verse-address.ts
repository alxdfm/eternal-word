import { type Result, err, ok } from '@eternal-word/shared'

/** Canonical address of a verse. The same triple is used as PDA seeds
 * on-chain, so the numeric book index — never a name — is authoritative:
 * book names vary between translations, indexes do not. */
export interface VerseAddress {
  readonly book: number
  readonly chapter: number
  readonly verse: number
}

export const FIRST_BOOK = 1
export const LAST_BOOK = 66
export const BOOK_COUNT = 66
export const CHAPTER_COUNT = 1189

/** Highest chapter number in the canon (Psalms). Range guard only —
 * the real per-book versification lives in the catalog. */
export const MAX_CHAPTER = 150
/** Highest verse number in the canon (Psalm 119). Range guard only. */
export const MAX_VERSE = 176

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

/**
 * Builds a verse address, enforcing the invariants that hold for every
 * translation. Whether the address actually exists in a given versification
 * is a catalog question, not a domain one.
 */
export function createVerseAddress(
  book: number,
  chapter: number,
  verse: number,
): Result<VerseAddress> {
  if (!Number.isInteger(book) || book < FIRST_BOOK || book > LAST_BOOK) {
    return err(`book index out of range: expected ${FIRST_BOOK}-${LAST_BOOK}, got ${book}`)
  }
  if (!isPositiveInteger(chapter) || chapter > MAX_CHAPTER) {
    return err(`chapter out of range: expected 1-${MAX_CHAPTER}, got ${chapter}`)
  }
  if (!isPositiveInteger(verse) || verse > MAX_VERSE) {
    return err(`verse out of range: expected 1-${MAX_VERSE}, got ${verse}`)
  }
  return ok({ book, chapter, verse })
}

export function verseAddressEquals(a: VerseAddress, b: VerseAddress): boolean {
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse
}

/** Stable key for maps and caches — cheaper than repeated deep comparison
 * over 31k addresses. */
export function verseAddressKey(address: VerseAddress): string {
  return `${address.book}:${address.chapter}:${address.verse}`
}

export function compareVerseAddress(a: VerseAddress, b: VerseAddress): number {
  return a.book - b.book || a.chapter - b.chapter || a.verse - b.verse
}
