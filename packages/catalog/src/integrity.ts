import { BOOK_COUNT, CHAPTER_COUNT, type VerseAddress, verseAddressKey } from '@eternal-word/domain'
import type { CanonicalBook } from './dataset.js'
import { listOmittedPositions, listRegistrableVerses } from './dataset.js'

/** Totals of the committed snapshot (World English Bible, engwebp).
 * These are constants, not expectations: if the dataset stops matching them
 * something changed that must not have changed. */
export const EXPECTED_BOOKS = BOOK_COUNT
export const EXPECTED_CHAPTERS = CHAPTER_COUNT
export const EXPECTED_REGISTRABLE_VERSES = 31098

/** Positions carried by the traditional numbering that the WEB leaves
 * without text — see data/canonical-text/PROVENANCE.md.
 *
 * The first four are textual variants absent from the Majority Text. The
 * fifth is only a numbering shift: the Romans doxology lives at 14:24-26 in
 * this edition, so no text is lost — only its address changes. */
export const EXPECTED_OMITTED: readonly VerseAddress[] = [
  { book: 42, chapter: 17, verse: 36 }, // Luke 17:36
  { book: 44, chapter: 8, verse: 37 }, // Acts 8:37
  { book: 44, chapter: 15, verse: 34 }, // Acts 15:34
  { book: 44, chapter: 24, verse: 7 }, // Acts 24:7
  { book: 45, chapter: 16, verse: 25 }, // Romans 16:25 — doxology at 14:24-26
]

export interface IntegrityReport {
  readonly books: number
  readonly chapters: number
  readonly registrableVerses: number
  readonly omitted: readonly VerseAddress[]
  readonly problems: readonly string[]
}

/**
 * Checks the committed dataset against the invariants the whole project
 * rests on. Runs in CI: the Merkle root is derived from this data, so a
 * silent change here would silently change what is canonical.
 */
export function checkIntegrity(books: readonly CanonicalBook[]): IntegrityReport {
  const problems: string[] = []

  if (books.length !== EXPECTED_BOOKS) {
    problems.push(`expected ${EXPECTED_BOOKS} books, found ${books.length}`)
  }

  books.forEach((book, position) => {
    const expectedIndex = position + 1
    if (book.book !== expectedIndex) {
      problems.push(`book at position ${expectedIndex} carries index ${book.book}`)
    }
    if (book.chapters.length === 0) problems.push(`book ${book.book} has no chapters`)
    book.chapters.forEach((chapter, chapterIndex) => {
      if (chapter.length === 0) {
        problems.push(`book ${book.book} chapter ${chapterIndex + 1} has no verses`)
      }
    })
  })

  const chapters = books.reduce((total, book) => total + book.chapters.length, 0)
  if (chapters !== EXPECTED_CHAPTERS) {
    problems.push(`expected ${EXPECTED_CHAPTERS} chapters, found ${chapters}`)
  }

  const registrable = listRegistrableVerses(books)
  if (registrable.length !== EXPECTED_REGISTRABLE_VERSES) {
    problems.push(
      `expected ${EXPECTED_REGISTRABLE_VERSES} registrable verses, found ${registrable.length}`,
    )
  }

  const emptyText = registrable.filter((verse) => verse.text.trim() === '')
  for (const verse of emptyText) {
    problems.push(`empty text at ${verseAddressKey(verse.address)}`)
  }

  const omitted = listOmittedPositions(books)
  const omittedKeys = new Set(omitted.map(verseAddressKey))
  const expectedKeys = new Set(EXPECTED_OMITTED.map(verseAddressKey))

  for (const key of expectedKeys) {
    if (!omittedKeys.has(key)) problems.push(`expected omitted position missing: ${key}`)
  }
  for (const key of omittedKeys) {
    if (!expectedKeys.has(key)) problems.push(`unexpected omitted position: ${key}`)
  }

  return {
    books: books.length,
    chapters,
    registrableVerses: registrable.length,
    omitted,
    problems,
  }
}
