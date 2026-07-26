import type {
  BookProgress,
  ChapterProgress,
  DashboardAggregates,
  DayCount,
  ListFilter,
  Paginated,
  VerseListItem,
} from './read-model.js'

/**
 * The mirror's aggregate read side — dashboards, listings and progress for the
 * exploration screens. Separate from {@link VerseReadRepository} (single-verse)
 * and from the sync write side, so a read never reaches for a write. The Drizzle
 * adapter lives in infrastructure (FD-10). `offset`/`limit` are pre-validated by
 * the use case; the adapter just runs the query.
 */
export interface AggregateReadRepository {
  dashboardAggregates(): Promise<DashboardAggregates>
  /** Registered verses grouped by calendar day (ascending), for the trend. */
  registrationsByDay(): Promise<readonly DayCount[]>
  listVerses(filter: ListFilter, offset: number, limit: number): Promise<Paginated<VerseListItem>>
  /** All 66 books, including those with zero registrations. */
  bookProgress(): Promise<readonly BookProgress[]>
  /** Every chapter of one book, in ascending order. */
  chapterProgress(book: number): Promise<readonly ChapterProgress[]>
}
