import { type SearchRepository, searchVerses } from '@eternal-word/application'
import type { SearchResponseDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json, toInt } from './http.js'

interface RawParams {
  readonly q?: string | undefined
  readonly limit?: string | undefined
  readonly page?: string | undefined
}

const DEFAULT_PAGE_SIZE = 20

/**
 * GET a full-text search over the canonical text (`?q=…&limit=…&page=…`). An
 * empty query returns no hits (no DB round-trip); the limit is clamped in the
 * use case. `page` (1-based) drives the offset for pagination (UX-08).
 * Reference lookups are the existing `GET /` route — this is text only.
 */
export async function handleSearch(
  repo: SearchRepository,
  params: RawParams,
): Promise<HttpResponse> {
  const query = params.q ?? ''
  const limit = toInt(params.limit) ?? DEFAULT_PAGE_SIZE
  const page = Math.max(1, toInt(params.page) ?? 1)
  const offset = (page - 1) * limit
  const { hits, total } = await searchVerses(repo, query, limit, offset)
  const dto: SearchResponseDto = { query: query.trim(), hits, total }
  return json(200, dto)
}
