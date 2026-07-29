import { type AggregateReadRepository, getChapterVerses } from '@eternal-word/application'
import type { ChapterVersesResponseDto } from '@eternal-word/shared/contracts'
import { type HttpResponse, json, toInt } from './http.js'
import { toVerseListItemDto } from './verse-dto.js'

interface RawParams {
  readonly book?: string | undefined
  readonly chapter?: string | undefined
}

/**
 * GET a whole chapter: every registrable verse of (book, chapter) with its
 * status, in canonical order (UX-10). Bounded by the longest chapter, so it is
 * never paginated server-side — the web paginates the display and the bulk
 * register (UX-11) reads the full AVAILABLE set from one payload. A chapter that
 * does not exist answers 404.
 */
export async function handleChapterVerses(
  repo: AggregateReadRepository,
  params: RawParams,
): Promise<HttpResponse> {
  const book = toInt(params.book)
  const chapter = toInt(params.chapter)
  if (book === null || chapter === null) {
    return json(400, { error: 'book and chapter must be integers' })
  }
  const result = await getChapterVerses(repo, book, chapter)
  if (result.kind === 'invalid') {
    return json(400, { error: result.reason })
  }
  if (result.kind === 'notFound') {
    return json(404, { error: 'chapter not found' })
  }
  const dto: ChapterVersesResponseDto = {
    book,
    chapter,
    verses: result.verses.map(toVerseListItemDto),
  }
  return json(200, dto)
}
