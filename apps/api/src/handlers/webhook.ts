import { recordRegistered } from '@eternal-word/application'
import { parseHeliusWebhook } from '@eternal-word/infrastructure'
import { context } from '../context.js'

interface HttpEvent {
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
 */
export async function handler(event: HttpEvent): Promise<HttpResult> {
  const { repo } = context()
  const payload: unknown = event.body ? JSON.parse(event.body) : []
  const registrations = parseHeliusWebhook(payload)
  for (const registration of registrations) {
    await recordRegistered(repo, registration)
  }
  return { statusCode: 200, body: JSON.stringify({ recorded: registrations.length }) }
}
