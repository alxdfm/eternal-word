import { BOOK_COUNT, FIRST_BOOK } from '@eternal-word/domain'
import type { AggregateReadRepository } from './aggregate-ports.js'
import type {
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

/** Clamps `pageSize` to [1, {@link MAX_PAGE_SIZE}] and `page` to >= 1 before the
 * query, so a hand-typed query string can never ask for an unbounded page. */
export async function listVerses(
  repo: AggregateReadRepository,
  filter: ListFilter,
  page: number,
  pageSize: number,
): Promise<Paginated<VerseListItem>> {
  const safeSize = Math.min(Math.max(1, Math.trunc(pageSize)), MAX_PAGE_SIZE)
  const safePage = Math.max(1, Math.trunc(page))
  return repo.listVerses(filter, (safePage - 1) * safeSize, safeSize)
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
