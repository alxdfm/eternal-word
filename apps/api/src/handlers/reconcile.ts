import { evaluateHeartbeat, expirePending, reconcile } from '@eternal-word/application'
import { context } from '../context.js'

// Sized for the 15-minute cron cadence (sst.config.ts): an external monitor must
// tolerate a full interval between beats before alarming, plus margin. ~15 min ≈
// 2,250 devnet slots at ~0.4s/slot, so 4,000 slots / 45 min give ~2–3 intervals
// of slack. Ver ADR docs/decisions/2026-07-23_tuning-de-custo-do-indexer.md.
const PENDING_TTL_MS = Number(process.env.INDEXER_PENDING_TTL_MS ?? 120_000)
const MAX_LAG_SLOTS = BigInt(process.env.INDEXER_MAX_LAG_SLOTS ?? 4_000)
const MAX_SILENCE_MS = Number(process.env.INDEXER_MAX_SILENCE_MS ?? 2_700_000)

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
  emitHealthMetric(health.healthy, health.lagSlots)
}

/**
 * Emit the indexer health as a CloudWatch metric via Embedded Metric Format
 * (HD-04). CloudWatch auto-extracts EMF from the log stream — no metric filter,
 * no AWS SDK dependency. The alarm in sst.config.ts watches `IndexerHealthy`
 * with `treatMissingData: breaching`, so it fires on BOTH R4 failure modes:
 * running-but-behind (this emits 0) and stopped (no data point at all).
 */
function emitHealthMetric(healthy: boolean, lagSlots: bigint | null): void {
  const stage = process.env.STAGE ?? 'unknown'
  const emf = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'EternalWord/Indexer',
          Dimensions: [['Stage']],
          Metrics: [
            { Name: 'IndexerHealthy', Unit: 'Count' },
            { Name: 'IndexerLagSlots', Unit: 'Count' },
          ],
        },
      ],
    },
    Stage: stage,
    IndexerHealthy: healthy ? 1 : 0,
    IndexerLagSlots: lagSlots === null ? 0 : Number(lagSlots),
  }
  process.stdout.write(`${JSON.stringify(emf)}\n`)
}
