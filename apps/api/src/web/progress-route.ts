import {
  type AggregateReadRepository,
  getBookProgress,
  getChapterProgress,
} from '@eternal-word/application'
import type { BookProgressDto, ChapterProgressResponseDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json, toInt } from './http.js'

interface RawParams {
  readonly book?: string | undefined
}

/**
 * GET progress. Without `book`, the 66-book mosaic (aggregate per book, always).
 * With `book`, that book's chapter breakdown for the drill-down (D3 — one book
 * per payload, never the whole tree).
 */
export async function handleProgress(
  repo: AggregateReadRepository,
  params: RawParams,
): Promise<HttpResponse> {
  if (params.book === undefined) {
    const books: readonly BookProgressDto[] = await getBookProgress(repo)
    return json(200, books)
  }
  const book = toInt(params.book)
  if (book === null) {
    return json(400, { error: 'book must be an integer' })
  }
  const result = await getChapterProgress(repo, book)
  if (result.kind === 'invalid') {
    return json(400, { error: result.reason })
  }
  const dto: ChapterProgressResponseDto = { book, chapters: result.chapters }
  return json(200, dto)
}
