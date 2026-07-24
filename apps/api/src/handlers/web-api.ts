import { webContext } from '../web/context.js'
import { json } from '../web/http.js'
import { handleReadVerse } from '../web/read-verse.js'

interface HttpEvent {
  readonly requestContext?: { readonly http?: { readonly method?: string } }
  readonly queryStringParameters?: Record<string, string | undefined> | null
}

interface HttpResult {
  readonly statusCode: number
  readonly body: string
}

/**
 * The web-facing API on a Lambda Function URL (D3 — the web is a pure client, so
 * the DB stays server-side). GET reads a verse by reference; the optimistic
 * PENDING write (camada 2) arrives in WB-05. CORS is set on the Function URL in
 * sst.config.ts.
 */
export async function handler(event: HttpEvent): Promise<HttpResult> {
  const method = event.requestContext?.http?.method ?? 'GET'
  if (method === 'GET') {
    const { readRepo } = webContext()
    const query = event.queryStringParameters ?? {}
    return handleReadVerse(readRepo, {
      book: query.book,
      chapter: query.chapter,
      verse: query.verse,
    })
  }
  return json(405, { error: 'method not allowed' })
}
