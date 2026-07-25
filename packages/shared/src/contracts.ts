/**
 * HTTP contract shared by the web API (apps/api) and the web client (apps/web).
 * Pure types — no runtime — so it is safe to import from the browser bundle, and
 * one place keeps the two ends of the wire from drifting.
 */

/** Verse status as the read API returns it (JSON-safe: slot is a string). */
export interface VerseStatusDto {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string | null
  readonly registrable: boolean
  readonly status: string | null
  readonly adopter: string | null
  readonly transaction: string | null
  readonly account: string | null
  readonly slot: string | null
  readonly registeredAt: string | null
}

/** Text + Merkle proof (hex siblings) for building the register transaction. */
export interface RegistrationProofDto {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string
  readonly proof: readonly string[]
}
