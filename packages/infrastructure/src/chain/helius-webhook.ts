import type { VerseRegistered } from '@eternal-word/application'
import { versePda, verseRegisteredEventsFromLogs } from '@eternal-word/blockchain'

/** A Helius "raw" webhook item — an RPC-shaped transaction. Only the fields the
 * decoder needs are declared; the rest of the payload is ignored. */
interface HeliusTransaction {
  readonly slot?: number
  readonly transaction?: { readonly signatures?: readonly string[] }
  readonly meta?: { readonly logMessages?: readonly string[] | null; readonly err?: unknown }
}

/**
 * Parses a Helius raw webhook payload (an array of transactions) into
 * VerseRegistered events — camada 1 in production, mirroring the dev
 * `logsSubscribe` adapter but request-driven. Same decoding of the
 * `Program data:` line, feeding the same `recordRegistered` use case. Failed
 * transactions carry no registration and are skipped; the reconciliation layer
 * backstops any delivery this handler misses. Ver ADR
 * docs/decisions/2026-07-21_fonte-de-eventos-do-indexer.md.
 */
export function parseHeliusWebhook(payload: unknown): VerseRegistered[] {
  if (!Array.isArray(payload)) return []
  const registrations: VerseRegistered[] = []
  for (const item of payload as readonly HeliusTransaction[]) {
    if (item.meta?.err != null) continue
    const signature = item.transaction?.signatures?.[0] ?? null
    for (const event of verseRegisteredEventsFromLogs(item.meta?.logMessages ?? [])) {
      const address = { book: event.book, chapter: event.chapter, verse: event.verse }
      registrations.push({
        address,
        adopter: event.adopter.toBase58(),
        account: versePda(address)[0].toBase58(),
        transaction: signature,
        slot: item.slot === undefined ? 0n : BigInt(item.slot),
        registeredAt: new Date(Number(event.createdAt) * 1000),
      })
    }
  }
  return registrations
}
