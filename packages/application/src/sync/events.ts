import type { VerseAddress } from '@eternal-word/domain'

/**
 * A confirmed registration, normalized from whatever source observed it — a
 * `logsSubscribe` stream in dev, a Helius webhook in prod. The on-chain
 * VerseRegistered event carries book/chapter/verse/adopter/created_at; the
 * source enriches it with the transaction signature, the confirmation slot and
 * the account address (docs/conventions/UBIQUITOUS_LANGUAGE.md → VerseRegistered).
 */
export interface VerseRegistered {
  readonly address: VerseAddress
  readonly adopter: string
  readonly account: string
  /** The registering transaction. A real-time event carries it; a
   * reconciliation read from `getProgramAccounts` cannot, so it is `null`
   * there — the repository then preserves any signature already stored. */
  readonly transaction: string | null
  readonly slot: bigint
  readonly registeredAt: Date
}
