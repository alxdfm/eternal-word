/**
 * Result pattern for business errors — see docs/conventions/CODE_STYLE.md.
 * Business failures are returned, not thrown; throwing is reserved for bugs
 * and unrecoverable infrastructure faults.
 */
export type Result<T, E = string> = { ok: true; data: T } | { ok: false; error: E }

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; data: T } {
  return result.ok
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok
}

/** Unwraps a result, throwing when it holds an error. Use in tests and at
 * boundaries where a failure is genuinely a bug. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.data
  throw new Error(`unwrap called on error result: ${String(result.error)}`)
}
