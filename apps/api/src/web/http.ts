export interface HttpResponse {
  readonly statusCode: number
  readonly body: string
}

export function json(statusCode: number, payload: unknown): HttpResponse {
  return { statusCode, body: JSON.stringify(payload) }
}
