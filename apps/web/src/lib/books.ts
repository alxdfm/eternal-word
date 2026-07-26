/**
 * Book and omitted-position knowledge for the UI. Display names live in i18n
 * (see messages/en.json `books`, guarded by a test against @eternal-word/catalog
 * so they can never drift from the canon). This module holds only the structure
 * the UI reasons about: the 1-66 range and the five positions the WEB leaves
 * without text — of two kinds, each shown as a note rather than an error.
 */

export const FIRST_BOOK = 1
export const LAST_BOOK = 66

/** Canon totals — projections of the catalog/domain constants (EXPECTED_BOOKS /
 * EXPECTED_CHAPTERS / EXPECTED_REGISTRABLE_VERSES), guarded by a test so the UI
 * never carries a stale magic number. */
export const BOOK_COUNT = 66
export const CHAPTER_COUNT = 1189
export const REGISTRABLE_VERSE_COUNT = 31098

/** [1, 2, …, 66] — book indexes in canonical order. */
export const BOOK_NUMBERS: readonly number[] = Array.from(
  { length: LAST_BOOK - FIRST_BOOK + 1 },
  (_, i) => FIRST_BOOK + i,
)

export function isBookNumber(value: number): boolean {
  return Number.isInteger(value) && value >= FIRST_BOOK && value <= LAST_BOOK
}

/** An absent variant leaves a gap in the numbering; a relocated verse's text
 * lives at another address (Romans 16:25 → Romans 14:24-26). */
export type OmittedKind = 'absent' | 'relocated'

export interface OmittedPosition {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly kind: OmittedKind
  /** For `absent`: the verse numbers the reader jumps between. */
  readonly prevVerse?: number
  readonly nextVerse?: number
  /** For `relocated`: where the text actually is. */
  readonly pointer?: {
    readonly book: number
    readonly chapter: number
    readonly verseStart: number
    readonly verseEnd: number
  }
}

/**
 * The five WEB positions with no registrable text. Positions are guarded by a
 * test against `EXPECTED_OMITTED` in the catalog; the *kind* and pointer are UI
 * product knowledge (which note to show), not canon data.
 */
export const OMITTED_POSITIONS: readonly OmittedPosition[] = [
  { book: 42, chapter: 17, verse: 36, kind: 'absent', prevVerse: 35, nextVerse: 37 },
  { book: 44, chapter: 8, verse: 37, kind: 'absent', prevVerse: 36, nextVerse: 38 },
  { book: 44, chapter: 15, verse: 34, kind: 'absent', prevVerse: 33, nextVerse: 35 },
  { book: 44, chapter: 24, verse: 7, kind: 'absent', prevVerse: 6, nextVerse: 8 },
  {
    book: 45,
    chapter: 16,
    verse: 25,
    kind: 'relocated',
    pointer: { book: 45, chapter: 14, verseStart: 24, verseEnd: 26 },
  },
]

const OMITTED_BY_KEY = new Map(
  OMITTED_POSITIONS.map((p) => [`${p.book}:${p.chapter}:${p.verse}`, p]),
)

/** The omitted-position record for a reference, or undefined if it is a normal
 * (registrable) position. */
export function omittedAt(
  book: number,
  chapter: number,
  verse: number,
): OmittedPosition | undefined {
  return OMITTED_BY_KEY.get(`${book}:${chapter}:${verse}`)
}
