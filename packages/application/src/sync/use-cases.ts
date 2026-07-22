import {
  VERSE_STATUS,
  type VerseAddress,
  createVerseAddress,
  verseAddressKey,
} from '@eternal-word/domain'
import { unwrap } from '@eternal-word/shared'
import type { VerseRegistered } from './events.js'
import type { ChainReader, VerseRepository } from './ports.js'

/** Camada 1: persist a confirmed registration. Validating the address here
 * means a corrupt event fails loud instead of poisoning the mirror. */
export async function recordRegistered(
  repo: VerseRepository,
  event: VerseRegistered,
): Promise<void> {
  unwrap(createVerseAddress(event.address.book, event.address.chapter, event.address.verse))
  await repo.recordRegistered(event)
}

/** Camada 2: mark a position PENDING when its transaction is submitted. The
 * promotion to REGISTERED only ever comes from the indexer, never the caller. */
export async function markPending(
  repo: VerseRepository,
  address: VerseAddress,
  transaction: string,
): Promise<void> {
  unwrap(createVerseAddress(address.book, address.chapter, address.verse))
  await repo.markPending(address, transaction)
}

/** Camada 2: age out PENDING rows stuck since before `cutoff`. */
export async function expirePending(repo: VerseRepository, cutoff: Date): Promise<VerseAddress[]> {
  return repo.failStalePending(cutoff)
}

export interface ReconcileReport {
  readonly recorded: number
  readonly released: number
}

/**
 * Camada 3: the chain is the source of truth. Record every on-chain
 * registration (idempotent), then walk back any mirror row the chain does not
 * back — a REGISTERED lost to a reorg, or a spent FAILED attempt. A PENDING not
 * yet on-chain is left alone; expiry ages it out.
 */
export async function reconcile(
  repo: VerseRepository,
  chain: ChainReader,
): Promise<ReconcileReport> {
  const onChain = await chain.listRegistrations()
  for (const event of onChain) {
    await repo.recordRegistered(event)
  }

  const onChainKeys = new Set(onChain.map((event) => verseAddressKey(event.address)))
  const entries = await repo.listNonAvailable()
  let released = 0
  for (const entry of entries) {
    if (onChainKeys.has(verseAddressKey(entry.address))) continue
    if (entry.status === VERSE_STATUS.REGISTERED || entry.status === VERSE_STATUS.FAILED) {
      await repo.releaseToAvailable(entry.address)
      released += 1
    }
  }
  return { recorded: onChain.length, released }
}
