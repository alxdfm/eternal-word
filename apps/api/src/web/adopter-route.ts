import {
  type AggregateReadRepository,
  DEFAULT_PAGE_SIZE,
  getAdopterProfile,
} from '@eternal-word/application'
import type { AdopterProfileDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json, toInt } from './http.js'
import { toVerseListItemDto } from './verse-dto.js'

interface RawParams {
  readonly pubkey?: string | undefined
  readonly page?: string | undefined
  readonly pageSize?: string | undefined
}

/**
 * GET an adopter profile by wallet (`?pubkey=…&page=…`). A wallet with no
 * registrations returns an empty profile (zeros, empty page) — never a 404 — so
 * a mistyped address just shows nothing, not an error.
 */
export async function handleAdopterProfile(
  repo: AggregateReadRepository,
  params: RawParams,
): Promise<HttpResponse> {
  const pubkey = (params.pubkey ?? '').trim()
  if (pubkey === '') {
    return json(400, { error: 'pubkey is required' })
  }
  const page = toInt(params.page) ?? 1
  const pageSize = toInt(params.pageSize) ?? DEFAULT_PAGE_SIZE

  const profile = await getAdopterProfile(repo, pubkey, page, pageSize)
  const dto: AdopterProfileDto = {
    adopter: profile.adopter,
    verses: profile.verses,
    books: profile.books,
    estimatedSol: profile.estimatedSol,
    coverage: profile.coverage,
    page: {
      items: profile.page.items.map(toVerseListItemDto),
      page: profile.page.page,
      pageSize: profile.page.pageSize,
      total: profile.page.total,
    },
  }
  return json(200, dto)
}
