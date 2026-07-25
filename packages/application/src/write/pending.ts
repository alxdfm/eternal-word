import { createVerseAddress } from '@eternal-word/domain'
import { isErr } from '@eternal-word/shared'
import type { VerseRepository } from '../sync/ports.js'

/** Outcome of an optimistic PENDING request from the site. */
export type MarkPendingResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'invalid'; readonly reason: string }

/**
 * Camada 2 (PENDING otimista): the site marks a verse PENDING when it submits
 * the register transaction. Promotion to REGISTERED comes only from the indexer
 * (camada 1/3) — never here. The repo moves AVAILABLE → PENDING only, so a
 * terminal REGISTERED is never disturbed (ADR
 * 2026-07-18_sincronizacao-indexer-tres-camadas).
 */
export async function markPendingRequest(
  repo: VerseRepository,
  book: number,
  chapter: number,
  verse: number,
  transaction: string,
): Promise<MarkPendingResult> {
  const address = createVerseAddress(book, chapter, verse)
  if (isErr(address)) {
    return { kind: 'invalid', reason: address.error }
  }
  await repo.markPending(address.data, transaction)
  return { kind: 'ok' }
}
