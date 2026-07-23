import type { EventSource, VerseRegistered } from '@eternal-word/application'
import { PROGRAM_ID, versePda, verseRegisteredEventsFromLogs } from '@eternal-word/blockchain'
import type { Connection } from '@solana/web3.js'

/**
 * Camada 1 (dev): a `logsSubscribe` stream on the program's logs. Anchor's
 * `emit!` writes VerseRegistered on the `Program data:` line, so every confirmed
 * registration — including ones made outside the site — surfaces here in
 * seconds, with no provider. The Helius webhook adapter (IX-05) plugs into this
 * same port. Ver ADR docs/decisions/2026-07-21_fonte-de-eventos-do-indexer.md.
 */
export function createLogsEventSource(connection: Connection): EventSource {
  return {
    async subscribe(onEvent) {
      const handle = async (lines: string[], signature: string, slot: number): Promise<void> => {
        for (const event of verseRegisteredEventsFromLogs(lines)) {
          const address = { book: event.book, chapter: event.chapter, verse: event.verse }
          const registered: VerseRegistered = {
            address,
            adopter: event.adopter.toBase58(),
            account: versePda(address)[0].toBase58(),
            transaction: signature,
            slot: BigInt(slot),
            registeredAt: new Date(Number(event.createdAt) * 1000),
          }
          await onEvent(registered)
        }
      }

      const subscriptionId = connection.onLogs(
        PROGRAM_ID,
        (logs, context) => {
          if (logs.err !== null) return // a failed transaction registered nothing
          // onLogs cannot await; catch so a handler error is never an unhandled
          // rejection. The reconciliation layer is the backstop for any miss.
          void handle(logs.logs, logs.signature, context.slot).catch((error) => {
            console.error('logs event source failed to handle a registration', error)
          })
        },
        'confirmed',
      )

      return () => connection.removeOnLogsListener(subscriptionId)
    },
  }
}
