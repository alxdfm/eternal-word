import { type VerseRepository, markPendingRequest } from '@eternal-word/application'
import { type HttpResponse, json } from './http.js'

interface PendingBody {
  readonly book?: unknown
  readonly chapter?: unknown
  readonly verse?: unknown
  readonly transaction?: unknown
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? parsed : null
  }
  return null
}

/**
 * POST the optimistic PENDING (camada 2): the site calls this right after it
 * submits the register transaction. Only AVAILABLE → PENDING happens here;
 * REGISTERED is never written by the web (that is the indexer's job, camada
 * 1/3). Idempotent — a repeat is a no-op.
 */
export async function handleMarkPending(
  repo: VerseRepository,
  rawBody: string | null | undefined,
): Promise<HttpResponse> {
  let body: PendingBody
  try {
    body = (rawBody ? JSON.parse(rawBody) : {}) as PendingBody
  } catch {
    return json(400, { error: 'invalid JSON body' })
  }

  const book = toInt(body.book)
  const chapter = toInt(body.chapter)
  const verse = toInt(body.verse)
  const transaction =
    typeof body.transaction === 'string' && body.transaction !== '' ? body.transaction : null
  if (book === null || chapter === null || verse === null || transaction === null) {
    return json(400, {
      error: 'book, chapter, verse (integers) and transaction (string) are required',
    })
  }

  const result = await markPendingRequest(repo, book, chapter, verse, transaction)
  if (result.kind === 'invalid') {
    return json(400, { error: result.reason })
  }
  return json(200, { status: 'PENDING' })
}
