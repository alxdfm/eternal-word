import type { VerseAddress, VerseStatus } from '@eternal-word/domain'
import type { VerseRegistered } from './events.js'

export type Unsubscribe = () => void | Promise<void>

/** Real-time source of confirmed registrations — camada 1. */
export interface EventSource {
  subscribe(onEvent: (event: VerseRegistered) => void | Promise<void>): Promise<Unsubscribe>
}

/** Reads the full on-chain registration set for reconciliation — camada 3. */
export interface ChainReader {
  listRegistrations(): Promise<VerseRegistered[]>
}

/** A mirror row that is not AVAILABLE — what reconciliation diffs against the
 * chain. */
export interface MirrorEntry {
  readonly address: VerseAddress
  readonly status: VerseStatus
}

/**
 * The off-chain mirror. Every write goes through here, so the sync core never
 * touches a driver — the Drizzle adapter lives in `infrastructure` (FD-10).
 */
export interface VerseRepository {
  /** Idempotent upsert to REGISTERED — camada 1/3. */
  recordRegistered(event: VerseRegistered): Promise<void>
  /** Optimistic PENDING at submission time — camada 2. */
  markPending(address: VerseAddress, transaction: string): Promise<void>
  /** PENDING last touched before `cutoff` → FAILED; returns what changed. */
  failStalePending(cutoff: Date): Promise<VerseAddress[]>
  /** Every row not AVAILABLE — the reconciliation diff set. */
  listNonAvailable(): Promise<MirrorEntry[]>
  /** A position not confirmed on-chain → back to AVAILABLE (reorg / retry). */
  releaseToAvailable(address: VerseAddress): Promise<void>
}
