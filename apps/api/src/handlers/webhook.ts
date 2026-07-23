import { recordRegistered } from '@eternal-word/application'
import { parseHeliusWebhook } from '@eternal-word/infrastructure'
import { context } from '../context.js'

interface HttpEvent {
  readonly headers?: Record<string, string | undefined>
  readonly body?: string | null
}

interface HttpResult {
  readonly statusCode: number
  readonly body: string
}

/**
 * Camada 1 in production: Helius posts confirmed registrations here. Parses the
 * delivered transactions, records each, and returns 200 so Helius does not retry
 * a handled delivery. Anything missed is caught by the reconciliation cron —
 * this handler need not be perfect.
 *
 * The Function URL is public, so a shared secret gates it: Helius sends it as
 * the `Authorization` header (its webhook `authHeader`), and a mismatch is
 * rejected — without this, anyone could inject fake registrations (the
 * reconciliation would heal them, but only after the fact).
 */
export async function handler(event: HttpEvent): Promise<HttpResult> {
  const expected = process.env.WEBHOOK_AUTH_TOKEN
  if (expected !== undefined && expected !== '' && event.headers?.authorization !== expected) {
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) }
  }

  const { repo } = context()
  const payload: unknown = event.body ? JSON.parse(event.body) : []
  const registrations = parseHeliusWebhook(payload)
  for (const registration of registrations) {
    await recordRegistered(repo, registration)
  }
  return { statusCode: 200, body: JSON.stringify({ recorded: registrations.length }) }
}
