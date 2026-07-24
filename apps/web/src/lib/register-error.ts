export type RegisterErrorKind = 'rejected' | 'insufficient' | 'expired' | 'duplicate' | 'generic'

/**
 * Classifies a register failure into a stable kind, so the UI can show a
 * friendly message instead of a raw RPC/wallet error. Best-effort substring
 * match — the underlying errors carry no stable codes across wallets.
 */
export function registerErrorKey(error: unknown): RegisterErrorKind {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('user rejected') || message.includes('rejected the request')) {
    return 'rejected'
  }
  if (message.includes('insufficient') || message.includes('debit an account')) {
    return 'insufficient'
  }
  if (
    message.includes('block height exceeded') ||
    message.includes('not confirmed') ||
    message.includes('expired')
  ) {
    return 'expired'
  }
  if (
    message.includes('already in use') ||
    message.includes('custom program error') ||
    message.includes('0x0')
  ) {
    return 'duplicate'
  }
  return 'generic'
}
