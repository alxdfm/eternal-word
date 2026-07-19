import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Testament, VerseAddress } from '@eternal-word/domain'

/** One book file of the CanonicalText, as committed in data/canonical-text/. */
export interface CanonicalBook {
  readonly book: number
  readonly name: string
  readonly abbreviation: string
  readonly testament: Testament
  /** Chapters in order; each holds its verses in order. `null` marks a
   * position that exists in the traditional numbering but has no text in
   * this translation — not registrable. */
  readonly chapters: readonly (readonly (string | null)[])[]
}

export interface CanonicalVerse {
  readonly address: VerseAddress
  readonly text: string
}

export const CANONICAL_TEXT_DIR = fileURLToPath(
  new URL('../../../data/canonical-text/', import.meta.url),
)

export function loadCanonicalBooks(directory: string = CANONICAL_TEXT_DIR): CanonicalBook[] {
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()

  const books = files.map((file) => JSON.parse(readFileSync(join(directory, file), 'utf8')))
  return books.sort((a: CanonicalBook, b: CanonicalBook) => a.book - b.book)
}

/**
 * Every registrable verse, in canonical order. Omitted positions are skipped:
 * they have no text, so there is nothing to register and no Merkle leaf.
 * This ordering is the one the Merkle tree is built from — changing it
 * changes the root.
 */
export function listRegistrableVerses(books: readonly CanonicalBook[]): CanonicalVerse[] {
  const verses: CanonicalVerse[] = []
  for (const book of books) {
    book.chapters.forEach((chapter, chapterIndex) => {
      chapter.forEach((text, verseIndex) => {
        if (text === null) return
        verses.push({
          address: { book: book.book, chapter: chapterIndex + 1, verse: verseIndex + 1 },
          text,
        })
      })
    })
  }
  return verses
}

/** Positions present in the numbering but without text in this translation. */
export function listOmittedPositions(books: readonly CanonicalBook[]): VerseAddress[] {
  const omitted: VerseAddress[] = []
  for (const book of books) {
    book.chapters.forEach((chapter, chapterIndex) => {
      chapter.forEach((text, verseIndex) => {
        if (text !== null) return
        omitted.push({ book: book.book, chapter: chapterIndex + 1, verse: verseIndex + 1 })
      })
    })
  }
  return omitted
}
