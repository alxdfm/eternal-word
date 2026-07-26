import { handleAdopterProfile } from '../web/adopter-route.js'
import { webContext } from '../web/context.js'
import { handleDashboard } from '../web/dashboard-route.js'
import { json } from '../web/http.js'
import { handleListVerses } from '../web/listings-route.js'
import { handleMarkPending } from '../web/pending-route.js'
import { handleProgress } from '../web/progress-route.js'
import { handleProof } from '../web/proof-route.js'
import { handleReadVerse } from '../web/read-verse.js'
import { handleSearch } from '../web/search-route.js'

interface HttpEvent {
  readonly requestContext?: { readonly http?: { readonly method?: string } }
  readonly rawPath?: string
  readonly queryStringParameters?: Record<string, string | undefined> | null
  readonly body?: string | null
}

interface HttpResult {
  readonly statusCode: number
  readonly body: string
}

/**
 * The web-facing API on a Lambda Function URL (D3 — the web is a pure client, so
 * the DB stays server-side). Routes:
 *   GET  /          → verse status by reference
 *   GET  /proof     → text + Merkle proof for the register_verse transaction
 *   GET  /dashboard → global aggregates (S05)
 *   GET  /progress  → per-book progress; ?book=N drills into that book's chapters (S05)
 *   GET  /verses    → paginated explore listing (?filter, ?page, ?pageSize) (S05)
 *   GET  /search    → full-text search over the canonical text (?q, ?limit) (S05)
 *   GET  /adopter   → one wallet's profile (?pubkey, ?page, ?pageSize) (S05)
 *   POST /pending   → optimistic PENDING at submit time (camada 2)
 * CORS is set on the Function URL in sst.config.ts.
 */
export async function handler(event: HttpEvent): Promise<HttpResult> {
  const method = event.requestContext?.http?.method ?? 'GET'
  const path = event.rawPath ?? '/'
  const ctx = webContext()

  if (method === 'GET') {
    const query = event.queryStringParameters ?? {}
    if (path.endsWith('/dashboard')) {
      return handleDashboard(ctx.aggregateRepo)
    }
    if (path.endsWith('/progress')) {
      return handleProgress(ctx.aggregateRepo, { book: query.book })
    }
    if (path.endsWith('/verses')) {
      return handleListVerses(ctx.aggregateRepo, {
        filter: query.filter,
        page: query.page,
        pageSize: query.pageSize,
      })
    }
    if (path.endsWith('/search')) {
      return handleSearch(ctx.searchRepo, { q: query.q, limit: query.limit })
    }
    if (path.endsWith('/adopter')) {
      return handleAdopterProfile(ctx.aggregateRepo, {
        pubkey: query.pubkey,
        page: query.page,
        pageSize: query.pageSize,
      })
    }
    const params = { book: query.book, chapter: query.chapter, verse: query.verse }
    return path.endsWith('/proof')
      ? handleProof(ctx.chapterReader, params)
      : handleReadVerse(ctx.readRepo, params)
  }
  if (method === 'POST' && path.endsWith('/pending')) {
    return handleMarkPending(ctx.writeRepo, event.body)
  }
  return json(405, { error: 'method not allowed' })
}
