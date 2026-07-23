import {
  BOOKS,
  listOmittedPositions,
  listRegistrableVerses,
  loadCanonicalBooks,
} from '@eternal-word/catalog'
import { eq } from 'drizzle-orm'
import type { Database } from './client.js'
import { books, translations, verseTexts, verses } from './schema.js'

/** The one translation that lives on-chain — World English Bible (engwebp),
 * public domain. Its metadata mirrors data/canonical-text/PROVENANCE.md. */
const CANONICAL_TRANSLATION = {
  code: 'engwebp',
  name: 'World English Bible',
  language: 'en',
  license: 'public domain',
  sourceUrl: 'https://ebible.org/details.php?id=engwebp',
  isCanonical: true,
} as const

export interface SeedCounts {
  translations: number
  books: number
  verseTexts: number
  verses: number
}

const CHUNK = 1000

// Postgres caps parameters per statement (~65k); 31k rows blow past it in one
// INSERT, so writes go in chunks.
async function insertInChunks<T>(rows: readonly T[], run: (chunk: T[]) => PromiseLike<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await run(rows.slice(i, i + CHUNK))
  }
}

/**
 * Rebuilds the catalog tables and the AVAILABLE positions of `verses` from the
 * committed CanonicalText. Idempotent by construction: every insert is
 * `onConflictDoNothing`, so re-running never duplicates and — the point that
 * matters — **never walks an indexer-set `verses` row (PENDING/REGISTERED/…)
 * back to AVAILABLE**. The blockchain is the source of truth for status; the
 * seed only ever fills gaps.
 */
export async function seed(db: Database): Promise<SeedCounts> {
  const canonicalBooks = loadCanonicalBooks()
  const chaptersByBook = new Map(canonicalBooks.map((book) => [book.book, book.chapters.length]))

  await db.insert(translations).values(CANONICAL_TRANSLATION).onConflictDoNothing({
    target: translations.code,
  })
  const [translation] = await db
    .select({ id: translations.id })
    .from(translations)
    .where(eq(translations.code, CANONICAL_TRANSLATION.code))
  if (translation === undefined) {
    throw new Error('canonical translation row missing after insert')
  }
  const translationId = translation.id

  await db
    .insert(books)
    .values(
      BOOKS.map((book) => ({
        id: book.book,
        slug: book.slug,
        name: book.name,
        abbreviation: book.abbreviation,
        testament: book.testament,
        chaptersCount: chaptersByBook.get(book.book) ?? 0,
      })),
    )
    .onConflictDoNothing()

  // verse_texts holds every position: registrable ones with text, omitted ones
  // (5 in the WEB) with NULL — so the UI can show "omitted here", not a gap.
  const registrable = listRegistrableVerses(canonicalBooks)
  const omitted = listOmittedPositions(canonicalBooks)
  const verseTextRows = [
    ...registrable.map((entry) => ({
      translationId,
      book: entry.address.book,
      chapter: entry.address.chapter,
      verse: entry.address.verse,
      text: entry.text,
    })),
    ...omitted.map((address) => ({
      translationId,
      book: address.book,
      chapter: address.chapter,
      verse: address.verse,
      text: null,
    })),
  ]
  await insertInChunks(verseTextRows, (chunk) =>
    db.insert(verseTexts).values(chunk).onConflictDoNothing(),
  )

  // verses mirrors the on-chain state: one AVAILABLE row per registrable
  // position. Omitted positions have no account and no row here.
  const verseRows = registrable.map((entry) => ({
    book: entry.address.book,
    chapter: entry.address.chapter,
    verse: entry.address.verse,
  }))
  await insertInChunks(verseRows, (chunk) => db.insert(verses).values(chunk).onConflictDoNothing())

  return {
    translations: await db.$count(translations),
    books: await db.$count(books),
    verseTexts: await db.$count(verseTexts),
    verses: await db.$count(verses),
  }
}
