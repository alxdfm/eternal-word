import type { ChapterTextReader, ChapterVerseText } from '@eternal-word/application'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { Database } from './client.js'
import { translations, verseTexts } from './schema.js'

/**
 * Drizzle-backed {@link ChapterTextReader}. Returns a chapter's registrable
 * verses (canonical translation, text not null) in ascending verse order — the
 * canonical order the chapter Merkle tree is built from. The proof use-case
 * reconstructs the tree from exactly this.
 */
export function createChapterTextReader(db: Database): ChapterTextReader {
  return {
    async listChapter(book: number, chapter: number): Promise<readonly ChapterVerseText[]> {
      const rows = await db
        .select({ verse: verseTexts.verse, text: verseTexts.text })
        .from(verseTexts)
        .innerJoin(
          translations,
          and(eq(translations.id, verseTexts.translationId), eq(translations.isCanonical, true)),
        )
        .where(
          and(
            eq(verseTexts.book, book),
            eq(verseTexts.chapter, chapter),
            isNotNull(verseTexts.text),
          ),
        )
        .orderBy(asc(verseTexts.verse))
      // The WHERE guarantees non-null text; flatMap narrows it for the port type.
      return rows.flatMap((row) =>
        row.text === null ? [] : [{ verse: row.verse, text: row.text }],
      )
    },
  }
}
