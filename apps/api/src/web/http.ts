export interface HttpResponse {
  readonly statusCode: number
  readonly body: string
}

export function json(statusCode: number, payload: unknown): HttpResponse {
  return { statusCode, body: JSON.stringify(payload) }
}

/**
 * Parses a value as a base-10 integer, or null. Accepts a query-string value
 * (`string | undefined`) and a parsed JSON value (`number`), so both the GET
 * routes and the POST body use one parser.
 */
export function toInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isInteger(parsed) ? parsed : null
  }
  return null
}
