import { BOOK_COUNT, FIRST_BOOK } from '@eternal-word/domain'
import type { AggregateReadRepository } from './aggregate-ports.js'
import type {
  AdopterProfile,
  BookProgress,
  ChapterProgress,
  DashboardStats,
  ListFilter,
  Paginated,
  TrendPoint,
  VerseListItem,
} from './read-model.js'
import { estimateSol } from './sol-estimate.js'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50

/** Turns a per-day count series into a cumulative running total. */
export function toCumulativeTrend(days: readonly { day: string; count: number }[]): TrendPoint[] {
  let running = 0
  return days.map(({ day, count }) => {
    running += count
    return { day, cumulative: running }
  })
}

/** Assembles the dashboard: raw aggregates + the SOL estimate + the cumulative
 * trend, in as few round-trips as the repository allows. */
export async function getDashboard(repo: AggregateReadRepository): Promise<DashboardStats> {
  const [aggregates, byDay] = await Promise.all([
    repo.dashboardAggregates(),
    repo.registrationsByDay(),
  ])
  return {
    registered: aggregates.registered,
    pending: aggregates.pending,
    available: aggregates.available,
    failed: aggregates.failed,
    total: aggregates.total,
    uniqueAdopters: aggregates.uniqueAdopters,
    booksBegun: aggregates.booksBegun,
    chaptersBegun: aggregates.chaptersBegun,
    estimatedSol: estimateSol(aggregates.registered, aggregates.registeredTextBytes),
    trend: toCumulativeTrend(byDay),
  }
}

/** Clamps `pageSize` to [1, {@link MAX_PAGE_SIZE}] and `page` to >= 1, so a
 * hand-typed query string can never ask for an unbounded page. */
export function clampPage(page: number, pageSize: number): { offset: number; limit: number } {
  const limit = Math.min(Math.max(1, Math.trunc(pageSize)), MAX_PAGE_SIZE)
  const safePage = Math.max(1, Math.trunc(page))
  return { offset: (safePage - 1) * limit, limit }
}

export async function listVerses(
  repo: AggregateReadRepository,
  filter: ListFilter,
  page: number,
  pageSize: number,
): Promise<Paginated<VerseListItem>> {
  const { offset, limit } = clampPage(page, pageSize)
  return repo.listVerses(filter, offset, limit)
}

/** The full adopter profile in one payload (metrics + coverage + a page of the
 * wallet's verses). An unknown wallet yields zeros and an empty page — never an
 * error, so a mistyped address just shows an empty profile. */
export async function getAdopterProfile(
  repo: AggregateReadRepository,
  adopter: string,
  page: number,
  pageSize: number,
): Promise<AdopterProfile> {
  const { offset, limit } = clampPage(page, pageSize)
  const [summary, coverage, versesPage] = await Promise.all([
    repo.adopterSummary(adopter),
    repo.adopterCoverage(adopter),
    repo.adopterVerses(adopter, offset, limit),
  ])
  return {
    adopter,
    verses: summary.verses,
    books: summary.books,
    estimatedSol: estimateSol(summary.verses, summary.registeredTextBytes),
    coverage,
    page: versesPage,
  }
}

export function getBookProgress(repo: AggregateReadRepository): Promise<readonly BookProgress[]> {
  return repo.bookProgress()
}

export type ChapterProgressResult =
  | { readonly kind: 'ok'; readonly chapters: readonly ChapterProgress[] }
  | { readonly kind: 'invalid'; readonly reason: string }

/** Per-chapter progress for one book, guarding the 1-66 range so the payload
 * stays a single book (D3 — never the whole tree at once). */
export async function getChapterProgress(
  repo: AggregateReadRepository,
  book: number,
): Promise<ChapterProgressResult> {
  if (!Number.isInteger(book) || book < FIRST_BOOK || book > BOOK_COUNT) {
    return {
      kind: 'invalid',
      reason: `book index out of range: expected ${FIRST_BOOK}-${BOOK_COUNT}, got ${book}`,
    }
  }
  return { kind: 'ok', chapters: await repo.chapterProgress(book) }
}

export type ChapterVersesResult =
  | { readonly kind: 'ok'; readonly verses: readonly VerseListItem[] }
  | { readonly kind: 'invalid'; readonly reason: string }
  | { readonly kind: 'notFound' }

/**
 * Every registrable verse of one chapter, with status, for the whole-chapter
 * view (UX-10). Guards the 1-66 book range and a positive chapter; a
 * non-existent chapter (or one with no registrable verses) yields `notFound` so
 * the route answers 404, distinct from a real but empty result — which can't
 * happen, since every canonical chapter has at least one registrable verse.
 */
export async function getChapterVerses(
  repo: AggregateReadRepository,
  book: number,
  chapter: number,
): Promise<ChapterVersesResult> {
  if (!Number.isInteger(book) || book < FIRST_BOOK || book > BOOK_COUNT) {
    return {
      kind: 'invalid',
      reason: `book index out of range: expected ${FIRST_BOOK}-${BOOK_COUNT}, got ${book}`,
    }
  }
  if (!Number.isInteger(chapter) || chapter < 1) {
    return { kind: 'invalid', reason: `chapter must be a positive integer, got ${chapter}` }
  }
  const verses = await repo.chapterVerses(book, chapter)
  return verses.length === 0 ? { kind: 'notFound' } : { kind: 'ok', verses }
}
