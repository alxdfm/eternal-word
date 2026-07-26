import type { Testament, VerseStatus } from '@eternal-word/domain'

/**
 * Read models for the S05 exploration screens. All assembled by the read side
 * (never the sync core) from the off-chain mirror. Counts are raw; the UI
 * derives ratios and percentages so the server stays presentation-agnostic.
 */

/** Explore tabs. `recent` is newest-registered-first; the rest browse a single
 * status in canonical order. */
export type ListFilter = 'recent' | 'registered' | 'pending' | 'available'

export const LIST_FILTERS: readonly ListFilter[] = ['recent', 'registered', 'pending', 'available']

export function isListFilter(value: string): value is ListFilter {
  return (LIST_FILTERS as readonly string[]).includes(value)
}

/** One point of the cumulative registration trend (D5). */
export interface TrendPoint {
  readonly day: string
  readonly cumulative: number
}

/** The global dashboard, in one payload. */
export interface DashboardStats {
  readonly registered: number
  readonly pending: number
  readonly available: number
  readonly failed: number
  /** All registrable positions — 31,098; the denominator for "% of canon". */
  readonly total: number
  readonly uniqueAdopters: number
  readonly booksBegun: number
  readonly chaptersBegun: number
  /** Rent + fees, an ESTIMATE (see estimateSol) — the UI marks it approximate. */
  readonly estimatedSol: number
  readonly trend: readonly TrendPoint[]
}

/** Raw aggregates the repository returns; the use case shapes them into
 * {@link DashboardStats} (computing the SOL estimate and the trend). */
export interface DashboardAggregates {
  readonly registered: number
  readonly pending: number
  readonly available: number
  readonly failed: number
  readonly total: number
  readonly uniqueAdopters: number
  readonly booksBegun: number
  readonly chaptersBegun: number
  /** Sum of octet_length(text) over registered verses — feeds the rent estimate. */
  readonly registeredTextBytes: number
}

export interface DayCount {
  readonly day: string
  readonly count: number
}

/** One row of an explore listing. `text` is the canonical verse text (the UI
 * truncates it to a snippet). */
export interface VerseListItem {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly status: VerseStatus
  readonly text: string
  readonly adopter: string | null
  readonly transaction: string | null
  readonly registeredAt: Date | null
}

export interface Paginated<T> {
  readonly items: readonly T[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

/** Registered vs. registrable for one book — the mosaic denominator excludes
 * the omitted positions (they are not in `registrable`). `testament` groups the
 * mosaic into OT/NT without the client hardcoding the split. */
export interface BookProgress {
  readonly book: number
  readonly testament: Testament
  readonly registered: number
  readonly registrable: number
}

export interface ChapterProgress {
  readonly chapter: number
  readonly registered: number
  readonly registrable: number
}

/** One book's cell in an adopter's coverage grid: how many of the book's
 * registrable verses this wallet has registered. */
export interface BookCoverage {
  readonly book: number
  readonly registered: number
  readonly registrable: number
}

/** Raw per-adopter aggregate the repository returns; the use case adds the SOL
 * estimate. */
export interface AdopterSummary {
  readonly verses: number
  readonly books: number
  readonly registeredTextBytes: number
}

/** The full adopter profile: metrics + coverage + one page of their verses. */
export interface AdopterProfile {
  readonly adopter: string
  readonly verses: number
  readonly books: number
  readonly estimatedSol: number
  readonly coverage: readonly BookCoverage[]
  readonly page: Paginated<VerseListItem>
}
