/** Lifecycle of a verse in the off-chain mirror. The blockchain is the
 * source of truth; these states describe what the mirror knows. */
export const VERSE_STATUS = {
  /** No account on-chain — open for registration. */
  AVAILABLE: 'AVAILABLE',
  /** Transaction submitted, confirmation not yet observed by the indexer. */
  PENDING: 'PENDING',
  /** Account confirmed on-chain. Terminal and permanent. */
  REGISTERED: 'REGISTERED',
  /** Transaction failed or expired; reconciliation returns it to AVAILABLE. */
  FAILED: 'FAILED',
} as const

export type VerseStatus = (typeof VERSE_STATUS)[keyof typeof VERSE_STATUS]

const ALLOWED_TRANSITIONS: Record<VerseStatus, readonly VerseStatus[]> = {
  // AVAILABLE jumps straight to REGISTERED when the indexer observes a
  // registration made directly against the program, bypassing the site —
  // the protocol is permissionless, so this is a normal path, not an anomaly.
  AVAILABLE: [VERSE_STATUS.PENDING, VERSE_STATUS.REGISTERED],
  PENDING: [VERSE_STATUS.REGISTERED, VERSE_STATUS.FAILED],
  FAILED: [VERSE_STATUS.AVAILABLE, VERSE_STATUS.REGISTERED],
  // Registration is irreversible: no instruction can update or close a
  // VerseAccount, so the mirror must never walk this state back.
  REGISTERED: [],
}

export function canTransition(from: VerseStatus, to: VerseStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function isTerminal(status: VerseStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0
}
