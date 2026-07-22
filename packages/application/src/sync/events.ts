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
  readonly transaction: string
  readonly slot: bigint
  readonly registeredAt: Date
}
