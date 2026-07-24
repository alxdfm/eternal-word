import { type ChapterTextReader, buildRegistrationProof } from '@eternal-word/application'
import { type HttpResponse, json, parseIntParam } from './http.js'

interface RawParams {
  readonly book?: string | undefined
  readonly chapter?: string | undefined
  readonly verse?: string | undefined
}

/**
 * GET the Merkle proof + text for a verse, so the client can build the
 * `register_verse` transaction (ADR 2026-07-24_proof-servida-pela-lambda). The
 * proof is chapter-scoped and reconstructed from the Postgres text, so the
 * Lambda ships no canonical-text files and builds no global tree. The chain
 * validates the proof against the committed root regardless.
 */
export async function handleProof(
  reader: ChapterTextReader,
  params: RawParams,
): Promise<HttpResponse> {
  const book = parseIntParam(params.book)
  const chapter = parseIntParam(params.chapter)
  const verse = parseIntParam(params.verse)
  if (book === null || chapter === null || verse === null) {
    return json(400, { error: 'book, chapter and verse must be integers' })
  }

  const result = await buildRegistrationProof(reader, book, chapter, verse)
  switch (result.kind) {
    case 'invalid':
      return json(400, { error: result.reason })
    case 'not-registrable':
      return json(404, { error: 'verse is not registrable' })
    case 'ok':
      return json(200, { book, chapter, verse, text: result.text, proof: result.proof })
  }
}
