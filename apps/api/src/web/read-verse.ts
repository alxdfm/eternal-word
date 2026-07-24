import { type VerseReadRepository, lookupVerse } from '@eternal-word/application'
import { type HttpResponse, json, parseIntParam } from './http.js'
import { toVerseDto } from './verse-dto.js'

interface RawParams {
  readonly book?: string | undefined
  readonly chapter?: string | undefined
  readonly verse?: string | undefined
}

/**
 * GET a verse by reference. Parsing (string → int) is the HTTP concern here;
 * range validation and the DB read live in application (`lookupVerse`). An
 * omitted position is a 200 with `registrable: false` — never a 404 — so the
 * numbering gaps read as intentional in the UI.
 */
export async function handleReadVerse(
  repo: VerseReadRepository,
  params: RawParams,
): Promise<HttpResponse> {
  const book = parseIntParam(params.book)
  const chapter = parseIntParam(params.chapter)
  const verse = parseIntParam(params.verse)
  if (book === null || chapter === null || verse === null) {
    return json(400, { error: 'book, chapter and verse must be integers' })
  }

  const result = await lookupVerse(repo, book, chapter, verse)
  switch (result.kind) {
    case 'invalid':
      return json(400, { error: result.reason })
    case 'not-found':
      return json(404, { error: 'verse not found in the canonical versification' })
    case 'found':
      return json(200, toVerseDto(result.view))
  }
}
