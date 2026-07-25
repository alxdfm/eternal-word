import type { VerseAddress, VerseStatus } from '@eternal-word/domain'

/**
 * Read model of one verse for the web: the canonical text plus the mirror
 * status. Assembled by the read side (never the sync core). `text` null and
 * `registrable` false mark an omitted position (5 in the WEB) — present in the
 * numbering, not registrable, so it carries no status.
 */
export interface VerseView {
  readonly address: VerseAddress
  readonly text: string | null
  readonly registrable: boolean
  readonly status: VerseStatus | null
  readonly adopter: string | null
  readonly transaction: string | null
  readonly account: string | null
  readonly slot: bigint | null
  readonly registeredAt: Date | null
}
