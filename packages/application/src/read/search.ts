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

/**
 * Full-text search over the canonical text. Backed by a Postgres `tsvector` GIN
 * index (EX-03/D1) — never an ILIKE scan. The Drizzle adapter lives in
 * infrastructure (FD-10).
 */
export interface SearchRepository {
  searchByText(query: string, limit: number): Promise<readonly SearchHit[]>
}

export const DEFAULT_SEARCH_LIMIT = 20
export const MAX_SEARCH_LIMIT = 50

/** Trims the query (empty → no query, no DB round-trip) and clamps the limit
 * before hitting the index. */
export async function searchVerses(
  repo: SearchRepository,
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<readonly SearchHit[]> {
  const q = query.trim()
  if (q === '') {
    return []
  }
  const safeLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_SEARCH_LIMIT)
  return repo.searchByText(q, safeLimit)
}
