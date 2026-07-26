/**
 * SOL contributed by registrations — an ESTIMATE. Every registration pays the
 * account's rent-exempt minimum plus one signature fee; there is no cheap way to
 * read the exact lamports spent per transaction, so we reconstruct it from the
 * account size the way the S02 smoke test measured it (devnet):
 *
 *   Genesis 1:1  · text  56 B → account 114 B → 0.001684 SOL
 *   Esther 8:9   · text 493 B → account 551 B → 0.004726 SOL
 *
 * Both match `rent = 6960 × (textBytes + 58 + 128)`: the account carries 58 B of
 * fixed VerseAccount fields, and Solana rent counts a 128 B metadata header. The
 * UI always labels the resulting figure as approximate.
 */
const LAMPORTS_PER_SOL = 1_000_000_000
const RENT_LAMPORTS_PER_BYTE = 6960
const RENT_HEADER_BYTES = 128
const VERSE_ACCOUNT_FIXED_BYTES = 58
const SIGNATURE_FEE_LAMPORTS = 5000

/** Estimated SOL for `verseCount` registrations whose texts total `textBytes`. */
export function estimateSol(verseCount: number, textBytes: number): number {
  if (verseCount <= 0) {
    return 0
  }
  const rentBytes = textBytes + (VERSE_ACCOUNT_FIXED_BYTES + RENT_HEADER_BYTES) * verseCount
  const lamports = rentBytes * RENT_LAMPORTS_PER_BYTE + SIGNATURE_FEE_LAMPORTS * verseCount
  return lamports / LAMPORTS_PER_SOL
}
