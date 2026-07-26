import type {
  AggregateReadRepository,
  BookProgress,
  ChapterProgress,
  DashboardAggregates,
  DayCount,
  ListFilter,
  Paginated,
  VerseListItem,
} from '@eternal-word/application'
import { VERSE_STATUS, type VerseStatus } from '@eternal-word/domain'
import { type SQL, and, asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { Database } from './client.js'
import { translations, verseTexts, verses } from './schema.js'

/** WHERE + ORDER BY for each explore tab. `recent` surfaces the latest
 * registrations; the status tabs browse in canonical order. */
function filterQuery(filter: ListFilter): { where: SQL; order: SQL[] } {
  const canonical = [asc(verses.book), asc(verses.chapter), asc(verses.verse)]
  switch (filter) {
    case 'recent':
      return {
        where: eq(verses.status, VERSE_STATUS.REGISTERED),
        order: [desc(verses.registeredAt)],
      }
    case 'registered':
      return { where: eq(verses.status, VERSE_STATUS.REGISTERED), order: canonical }
    case 'pending':
      return { where: eq(verses.status, VERSE_STATUS.PENDING), order: [desc(verses.updatedAt)] }
    case 'available':
      return { where: eq(verses.status, VERSE_STATUS.AVAILABLE), order: canonical }
  }
}

const canonicalText = and(
  eq(translations.id, verseTexts.translationId),
  eq(translations.isCanonical, true),
)

/**
 * Drizzle-backed {@link AggregateReadRepository}. Aggregates run as GROUP BY over
 * the mirror (31k rows, cheap with the status index); the per-book registrable
 * denominators are canon constants, so they are computed once and memoized for
 * the warm container. No N+1 — every screen is a bounded number of queries.
 */
export function createAggregateReadRepository(db: Database): AggregateReadRepository {
  // Registrable positions per book never change (the canon is frozen). Compute
  // once and reuse — the mosaic and its drill-down both need these denominators.
  let denominators: Promise<Map<number, number>> | undefined

  function registrablePerBook(): Promise<Map<number, number>> {
    denominators ??= db
      .select({ book: verseTexts.book, n: count() })
      .from(verseTexts)
      .innerJoin(translations, canonicalText)
      .where(isNotNull(verseTexts.text))
      .groupBy(verseTexts.book)
      .then((rows) => new Map(rows.map((r) => [r.book, r.n])))
    return denominators
  }

  return {
    async dashboardAggregates(): Promise<DashboardAggregates> {
      const statusRows = await db
        .select({ status: verses.status, n: count() })
        .from(verses)
        .groupBy(verses.status)
      const byStatus = new Map<string, number>(statusRows.map((r) => [r.status, r.n]))
      const registered = byStatus.get(VERSE_STATUS.REGISTERED) ?? 0
      const pending = byStatus.get(VERSE_STATUS.PENDING) ?? 0
      const available = byStatus.get(VERSE_STATUS.AVAILABLE) ?? 0
      const failed = byStatus.get(VERSE_STATUS.FAILED) ?? 0

      const [agg] = await db
        .select({
          uniqueAdopters: sql<number>`count(distinct ${verses.adopter})`.mapWith(Number),
          booksBegun: sql<number>`count(distinct ${verses.book})`.mapWith(Number),
          chaptersBegun:
            sql<number>`count(distinct (${verses.book} * 1000 + ${verses.chapter}))`.mapWith(
              Number,
            ),
          registeredTextBytes:
            sql<number>`coalesce(sum(octet_length(${verseTexts.text})), 0)`.mapWith(Number),
        })
        .from(verses)
        .innerJoin(
          verseTexts,
          and(
            eq(verseTexts.book, verses.book),
            eq(verseTexts.chapter, verses.chapter),
            eq(verseTexts.verse, verses.verse),
          ),
        )
        .innerJoin(translations, canonicalText)
        .where(eq(verses.status, VERSE_STATUS.REGISTERED))

      return {
        registered,
        pending,
        available,
        failed,
        total: registered + pending + available + failed,
        uniqueAdopters: agg?.uniqueAdopters ?? 0,
        booksBegun: agg?.booksBegun ?? 0,
        chaptersBegun: agg?.chaptersBegun ?? 0,
        registeredTextBytes: agg?.registeredTextBytes ?? 0,
      }
    },

    async registrationsByDay(): Promise<readonly DayCount[]> {
      const day = sql<string>`to_char(date_trunc('day', ${verses.registeredAt}), 'YYYY-MM-DD')`
      const rows = await db
        .select({ day, count: count() })
        .from(verses)
        .where(and(eq(verses.status, VERSE_STATUS.REGISTERED), isNotNull(verses.registeredAt)))
        .groupBy(day)
        .orderBy(day)
      return rows.map((r) => ({ day: r.day, count: r.count }))
    },

    async listVerses(filter, offset, limit): Promise<Paginated<VerseListItem>> {
      const { where, order } = filterQuery(filter)
      const [{ total }] = (await db.select({ total: count() }).from(verses).where(where)) as [
        { total: number },
      ]

      const rows = await db
        .select({
          book: verses.book,
          chapter: verses.chapter,
          verse: verses.verse,
          status: verses.status,
          text: verseTexts.text,
          adopter: verses.adopter,
          transaction: verses.transaction,
          registeredAt: verses.registeredAt,
        })
        .from(verses)
        .innerJoin(
          verseTexts,
          and(
            eq(verseTexts.book, verses.book),
            eq(verseTexts.chapter, verses.chapter),
            eq(verseTexts.verse, verses.verse),
          ),
        )
        .innerJoin(translations, canonicalText)
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset)

      const items: VerseListItem[] = rows.map((r) => ({
        book: r.book,
        chapter: r.chapter,
        verse: r.verse,
        status: r.status as VerseStatus,
        text: r.text ?? '',
        adopter: r.adopter,
        transaction: r.transaction,
        registeredAt: r.registeredAt,
      }))
      return { items, page: Math.floor(offset / limit) + 1, pageSize: limit, total }
    },

    async bookProgress(): Promise<readonly BookProgress[]> {
      const registrable = await registrablePerBook()
      const registeredRows = await db
        .select({ book: verses.book, n: count() })
        .from(verses)
        .where(eq(verses.status, VERSE_STATUS.REGISTERED))
        .groupBy(verses.book)
      const registered = new Map(registeredRows.map((r) => [r.book, r.n]))
      return [...registrable.entries()]
        .map(([book, n]) => ({ book, registered: registered.get(book) ?? 0, registrable: n }))
        .sort((a, b) => a.book - b.book)
    },

    async chapterProgress(book): Promise<readonly ChapterProgress[]> {
      const registrableRows = await db
        .select({ chapter: verseTexts.chapter, n: count() })
        .from(verseTexts)
        .innerJoin(translations, canonicalText)
        .where(and(eq(verseTexts.book, book), isNotNull(verseTexts.text)))
        .groupBy(verseTexts.chapter)
      const registeredRows = await db
        .select({ chapter: verses.chapter, n: count() })
        .from(verses)
        .where(and(eq(verses.book, book), eq(verses.status, VERSE_STATUS.REGISTERED)))
        .groupBy(verses.chapter)
      const registered = new Map(registeredRows.map((r) => [r.chapter, r.n]))
      return registrableRows
        .map((r) => ({
          chapter: r.chapter,
          registered: registered.get(r.chapter) ?? 0,
          registrable: r.n,
        }))
        .sort((a, b) => a.chapter - b.chapter)
    },
  }
}
