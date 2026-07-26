/**
 * HTTP contract shared by the web API (apps/api) and the web client (apps/web).
 * Pure types — no runtime — so it is safe to import from the browser bundle, and
 * one place keeps the two ends of the wire from drifting.
 */

/** Verse status as the read API returns it (JSON-safe: slot is a string). */
export interface VerseStatusDto {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string | null
  readonly registrable: boolean
  readonly status: string | null
  readonly adopter: string | null
  readonly transaction: string | null
  readonly account: string | null
  readonly slot: string | null
  readonly registeredAt: string | null
}

/** Text + Merkle proof (hex siblings) for building the register transaction. */
export interface RegistrationProofDto {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string
  readonly proof: readonly string[]
}

/** One point of the cumulative registration trend (dashboard sparkline). */
export interface TrendPointDto {
  readonly day: string
  readonly cumulative: number
}

/** Global dashboard aggregates. `estimatedSol` is approximate (rent + fees). */
export interface DashboardStatsDto {
  readonly registered: number
  readonly pending: number
  readonly available: number
  readonly failed: number
  readonly total: number
  readonly uniqueAdopters: number
  readonly booksBegun: number
  readonly chaptersBegun: number
  readonly estimatedSol: number
  readonly trend: readonly TrendPointDto[]
}

/** One row of an explore/profile listing (JSON-safe: registeredAt is ISO). */
export interface VerseListItemDto {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly status: string
  readonly text: string
  readonly adopter: string | null
  readonly transaction: string | null
  readonly registeredAt: string | null
}

export interface PaginatedDto<T> {
  readonly items: readonly T[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

/** Registered vs. registrable for one book (the mosaic denominator excludes the
 * omitted positions). */
export interface BookProgressDto {
  readonly book: number
  readonly registered: number
  readonly registrable: number
}

export interface ChapterProgressDto {
  readonly chapter: number
  readonly registered: number
  readonly registrable: number
}

/** Per-book chapter breakdown for the progress-map drill-down. */
export interface ChapterProgressResponseDto {
  readonly book: number
  readonly chapters: readonly ChapterProgressDto[]
}
