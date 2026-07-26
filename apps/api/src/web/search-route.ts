import { type SearchRepository, searchVerses } from '@eternal-word/application'
import type { SearchResponseDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json, toInt } from './http.js'

interface RawParams {
  readonly q?: string | undefined
  readonly limit?: string | undefined
}

/**
 * GET a full-text search over the canonical text (`?q=…&limit=…`). An empty
 * query returns no hits (no DB round-trip); the limit is clamped in the use
 * case. Reference lookups are the existing `GET /` route — this is text only.
 */
export async function handleSearch(
  repo: SearchRepository,
  params: RawParams,
): Promise<HttpResponse> {
  const query = params.q ?? ''
  const limit = toInt(params.limit) ?? undefined
  const hits = await searchVerses(repo, query, limit)
  const dto: SearchResponseDto = { query: query.trim(), hits }
  return json(200, dto)
}
