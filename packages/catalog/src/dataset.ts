import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TESTAMENT, type Testament, type VerseAddress } from '@eternal-word/domain'

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

const TESTAMENTS: ReadonlySet<string> = new Set([TESTAMENT.OLD, TESTAMENT.NEW])

/** Validates the shape at the I/O boundary. Everything downstream — the
 * integrity report, the Merkle tree, the seed — trusts these types, so a
 * malformed file has to fail here, with the file name, instead of surfacing
 * as an obscure error deep in the tree construction. */
function parseBook(file: string, contents: string): CanonicalBook {
  const parsed: unknown = JSON.parse(contents)

  // Arrays are objects too — without this an array would slip through and
  // fail later with a misleading message about a missing field.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON object`)
  }

  const { book, name, abbreviation, testament, chapters } = parsed as Record<string, unknown>

  if (typeof book !== 'number' || !Number.isInteger(book)) {
    throw new Error(`${file}: "book" must be an integer index`)
  }
  if (typeof name !== 'string' || typeof abbreviation !== 'string') {
    throw new Error(`${file}: "name" and "abbreviation" must be strings`)
  }
  if (typeof testament !== 'string' || !TESTAMENTS.has(testament)) {
    throw new Error(`${file}: "testament" must be OLD or NEW`)
  }
  if (!Array.isArray(chapters)) {
    throw new Error(`${file}: "chapters" must be an array`)
  }

  chapters.forEach((chapter, index) => {
    if (!Array.isArray(chapter)) {
      throw new Error(`${file}: chapter ${index + 1} must be an array`)
    }
    for (const verse of chapter) {
      if (verse !== null && typeof verse !== 'string') {
        throw new Error(`${file}: chapter ${index + 1} holds a non-string verse`)
      }
    }
  })

  return {
    book,
    name,
    abbreviation,
    testament: testament as Testament,
    chapters: chapters as (string | null)[][],
  }
}

export function loadCanonicalBooks(directory: string = CANONICAL_TEXT_DIR): CanonicalBook[] {
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()

  return files
    .map((file) => parseBook(file, readFileSync(join(directory, file), 'utf8')))
    .sort((a, b) => a.book - b.book)
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
