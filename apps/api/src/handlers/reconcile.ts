import { evaluateHeartbeat, expirePending, reconcile } from '@eternal-word/application'
import { context } from '../context.js'

const PENDING_TTL_MS = Number(process.env.INDEXER_PENDING_TTL_MS ?? 120_000)
const MAX_LAG_SLOTS = BigInt(process.env.INDEXER_MAX_LAG_SLOTS ?? 300)
const MAX_SILENCE_MS = Number(process.env.INDEXER_MAX_SILENCE_MS ?? 900_000)

/**
 * Camadas 2/3 + R4 on a schedule (EventBridge cron): age out stale PENDING,
 * reconcile the mirror against the chain, stamp the heartbeat, and log an alert
 * when the indexer is unhealthy. This is the guarantee the real-time webhook is
 * not — it runs even when no registration happens.
 */
export async function handler(): Promise<void> {
  const { connection, repo, chain, heartbeat } = context()
  await expirePending(repo, new Date(Date.now() - PENDING_TTL_MS))
  const report = await reconcile(repo, chain)
  const chainSlot = BigInt(await connection.getSlot('confirmed'))
  await heartbeat.write(chainSlot)

  const health = evaluateHeartbeat(await heartbeat.read(), chainSlot, new Date(), {
    maxLagSlots: MAX_LAG_SLOTS,
    maxSilenceMs: MAX_SILENCE_MS,
  })
  process.stdout.write(
    `[indexer] reconcile recorded ${report.recorded}, released ${report.released}; ` +
      `slot ${chainSlot}, health ${health.healthy ? 'ok' : `ALERT ${health.reason}`}\n`,
  )
}
