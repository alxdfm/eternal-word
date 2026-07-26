import {
  type AggregateReadRepository,
  DEFAULT_PAGE_SIZE,
  isListFilter,
  listVerses,
} from '@eternal-word/application'
import type { PaginatedDto, VerseListItemDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json, toInt } from './http.js'
import { toVerseListItemDto } from './verse-dto.js'

interface RawParams {
  readonly filter?: string | undefined
  readonly page?: string | undefined
  readonly pageSize?: string | undefined
}

/**
 * GET a paginated verse listing for the explore screen. `filter` defaults to
 * `recent`; page/pageSize are clamped in the use case, so an out-of-range query
 * string can never ask for an unbounded page.
 */
export async function handleListVerses(
  repo: AggregateReadRepository,
  params: RawParams,
): Promise<HttpResponse> {
  const filter = params.filter ?? 'recent'
  if (!isListFilter(filter)) {
    return json(400, { error: 'filter must be one of recent, registered, pending, available' })
  }
  const page = toInt(params.page) ?? 1
  const pageSize = toInt(params.pageSize) ?? DEFAULT_PAGE_SIZE

  const result = await listVerses(repo, filter, page, pageSize)
  const dto: PaginatedDto<VerseListItemDto> = {
    items: result.items.map(toVerseListItemDto),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  }
  return json(200, dto)
}
