import type { VerseStatus } from '@eternal-word/domain'

/** One full-text search hit: the reference, its canonical text (the UI
 * highlights the match) and the mirror status (for the state chip). */
export interface SearchHit {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly status: VerseStatus
  readonly text: string
}

/** A page of search hits plus the total number of matches (for pagination). */
export interface SearchResult {
  readonly hits: readonly SearchHit[]
  readonly total: number
}

/**
 * Full-text search over the canonical text. Backed by a Postgres `tsvector` GIN
 * index (EX-03/D1) — never an ILIKE scan. The Drizzle adapter lives in
 * infrastructure (FD-10). Returns one page (`limit`/`offset`) plus the total
 * match count so the UI can paginate (UX-08).
 */
export interface SearchRepository {
  searchByText(query: string, limit: number, offset: number): Promise<SearchResult>
}

export const DEFAULT_SEARCH_LIMIT = 20
export const MAX_SEARCH_LIMIT = 50

/** Trims the query (empty → no query, no DB round-trip) and clamps the limit
 * and offset before hitting the index. */
export async function searchVerses(
  repo: SearchRepository,
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
  offset = 0,
): Promise<SearchResult> {
  const q = query.trim()
  if (q === '') {
    return { hits: [], total: 0 }
  }
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_SEARCH_LIMIT)
  const safeOffset = Math.max(0, Math.trunc(offset))
  return repo.searchByText(q, safeLimit, safeOffset)
}
