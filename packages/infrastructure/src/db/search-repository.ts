import type { SearchHit, SearchRepository } from '@eternal-word/application'
import type { VerseStatus } from '@eternal-word/domain'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from './client.js'
import { translations, verseTexts, verses } from './schema.js'

/**
 * Drizzle-backed {@link SearchRepository}. Full-text search over the canonical
 * translation using the `search_vector` GIN index (`@@`), ranked by relevance
 * then canonical order. `websearch_to_tsquery` accepts human syntax (quoted
 * phrases, OR) and the query is a bound parameter — no ILIKE scan, no injection.
 * Omitted positions have an empty vector and never match. The mirror status
 * comes along so each hit can show its state chip.
 */
export function createSearchRepository(db: Database): SearchRepository {
  return {
    async searchByText(query: string, limit: number): Promise<readonly SearchHit[]> {
      const tsquery = sql`websearch_to_tsquery('english', ${query})`
      const rows = await db
        .select({
          book: verseTexts.book,
          chapter: verseTexts.chapter,
          verse: verseTexts.verse,
          status: verses.status,
          text: verseTexts.text,
        })
        .from(verseTexts)
        .innerJoin(
          translations,
          and(eq(translations.id, verseTexts.translationId), eq(translations.isCanonical, true)),
        )
        .innerJoin(
          verses,
          and(
            eq(verses.book, verseTexts.book),
            eq(verses.chapter, verseTexts.chapter),
            eq(verses.verse, verseTexts.verse),
          ),
        )
        .where(sql`${verseTexts.searchVector} @@ ${tsquery}`)
        .orderBy(
          sql`ts_rank(${verseTexts.searchVector}, ${tsquery}) desc`,
          asc(verseTexts.book),
          asc(verseTexts.chapter),
          asc(verseTexts.verse),
        )
        .limit(limit)

      return rows.map((r) => ({
        book: r.book,
        chapter: r.chapter,
        verse: r.verse,
        status: r.status as VerseStatus,
        text: r.text ?? '',
      }))
    },
  }
}
