export interface HttpResponse {
  readonly statusCode: number
  readonly body: string
}

export function json(statusCode: number, payload: unknown): HttpResponse {
  return { statusCode, body: JSON.stringify(payload) }
}

/** Parses a query param as a base-10 integer; null for missing/blank/non-integer. */
export function parseIntParam(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}
