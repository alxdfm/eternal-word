import {
  type ChainReader,
  type EventSource,
  type HeartbeatStore,
  type HeartbeatThresholds,
  type VerseRepository,
  evaluateHeartbeat,
  expirePending,
  reconcile,
  recordRegistered,
} from '@eternal-word/application'
import type { Connection } from '@solana/web3.js'

export interface IndexerOptions {
  readonly connection: Connection
  readonly repo: VerseRepository
  readonly events: EventSource
  readonly chain: ChainReader
  readonly heartbeat: HeartbeatStore
  readonly reconcileIntervalMs: number
  readonly pendingTtlMs: number
  readonly thresholds: HeartbeatThresholds
  readonly log?: (message: string) => void
}

export interface RunningIndexer {
  stop(): Promise<void>
}

const defaultLog = (message: string): void => {
  process.stdout.write(`[indexer] ${message}\n`)
}

/**
 * Wires the three sync layers: a real-time event subscription (camada 1) plus a
 * periodic loop that reconciles against the chain, ages out PENDING and stamps
 * the heartbeat (camadas 2/3, R4). Returns a handle to stop both. The caller
 * owns the connection and the adapters.
 */
export async function runIndexer(options: IndexerOptions): Promise<RunningIndexer> {
  const log = options.log ?? defaultLog

  const unsubscribe = await options.events.subscribe(async (event) => {
    await recordRegistered(options.repo, event)
    const { book, chapter, verse } = event.address
    log(`event: registered ${book}:${chapter}:${verse} @ slot ${event.slot}`)
  })

  const cycle = async (): Promise<void> => {
    try {
      const expired = await expirePending(options.repo, new Date(Date.now() - options.pendingTtlMs))
      const report = await reconcile(options.repo, options.chain)
      const chainSlot = BigInt(await options.connection.getSlot('confirmed'))
      await options.heartbeat.write(chainSlot)
      if (report.recorded > 0 || report.released > 0 || expired.length > 0) {
        log(
          `reconcile: recorded ${report.recorded}, released ${report.released}, expired ${expired.length}`,
        )
      }
      const health = evaluateHeartbeat(
        await options.heartbeat.read(),
        chainSlot,
        new Date(),
        options.thresholds,
      )
      if (!health.healthy) log(`ALERT: indexer unhealthy — ${health.reason}`)
    } catch (error) {
      process.stderr.write(`[indexer] reconcile cycle failed: ${String(error)}\n`)
    }
  }

  await cycle()
  const timer = setInterval(() => void cycle(), options.reconcileIntervalMs)

  return {
    async stop(): Promise<void> {
      clearInterval(timer)
      await unsubscribe()
    },
  }
}
