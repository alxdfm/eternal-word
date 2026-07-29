import { registerVerseTransaction } from '@eternal-word/blockchain/register'
import type { Connection, PublicKey, SendOptions, VersionedTransaction } from '@solana/web3.js'
import { fetchProof, markPending } from './api'

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Fetches the proof (served by the Lambda) and builds the unsigned
 * register_verse transaction for one verse against a caller-supplied blockhash.
 * Shared by the single-verse flow and the bulk register (UX-11), which signs
 * many of these at once with one wallet approval per batch.
 */
export async function buildRegisterTransaction(args: {
  readonly adopter: PublicKey
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly recentBlockhash: string
}): Promise<VersionedTransaction> {
  const { adopter, book, chapter, verse, recentBlockhash } = args
  const proof = await fetchProof(book, chapter, verse)
  return registerVerseTransaction({
    adopter,
    address: { book, chapter, verse },
    text: proof.text,
    proof: proof.proof.map(hexToBytes),
    recentBlockhash,
    // Measured CU is ~15-22k (PG-08); 400k gives ample headroom within budget.
    computeUnitLimit: 400_000,
    priorityFeeMicroLamports: 20_000,
  })
}

export interface RegisterVerseArgs {
  readonly connection: Connection
  readonly adopter: PublicKey
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly sendTransaction: (
    transaction: VersionedTransaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<string>
}

/**
 * Registers a verse from the browser: fetch the proof (served by the Lambda —
 * ADR 2026-07-24_proof-servida-pela-lambda), build the register_verse
 * transaction, and let the wallet sign and send it. The chain validates the
 * proof against the immutable committed root, so a wrong proof simply fails
 * on-chain. Returns the transaction signature.
 */
export async function registerVerse(args: RegisterVerseArgs): Promise<string> {
  const { connection, adopter, book, chapter, verse, sendTransaction } = args
  const { blockhash } = await connection.getLatestBlockhash()
  const transaction = await buildRegisterTransaction({
    adopter,
    book,
    chapter,
    verse,
    recentBlockhash: blockhash,
  })
  // Public devnet RPC can drop the first send (D5) — let web3.js retry.
  const signature = await sendTransaction(transaction, connection, { maxRetries: 5 })
  // Camada 2: optimistic PENDING. Best-effort — if it misses, the indexer still
  // promotes to REGISTERED (camada 1/3). Never blocks the returned signature.
  await markPending(book, chapter, verse, signature).catch(() => undefined)
  return signature
}
