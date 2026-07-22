/** Persisted liveness of the indexer. The reconciliation loop stamps it every
 * cycle, so an external monitor can tell a quiet indexer (no registrations) from
 * a dead one (R4) — a health check alone cannot. */
export interface HeartbeatState {
  readonly lastProcessedSlot: bigint
  readonly updatedAt: Date
}

export interface HeartbeatStore {
  read(): Promise<HeartbeatState | null>
  write(lastProcessedSlot: bigint): Promise<void>
}

export interface HeartbeatThresholds {
  /** How far behind the chain tip the indexer may fall before it is unhealthy. */
  readonly maxLagSlots: bigint
  /** How long without a beat before the indexer is considered stopped. */
  readonly maxSilenceMs: number
}

export interface HeartbeatHealth {
  readonly healthy: boolean
  readonly reason: string
  readonly lagSlots: bigint | null
  readonly silentForMs: number | null
}

/**
 * Decides whether the indexer is keeping up. Two failure modes, both from R4:
 * it stopped beating (silence — the process died), or it is beating but has
 * fallen behind the chain (lag). Silence is checked first: a dead indexer is
 * the failure that "passes unnoticed" without this.
 */
export function evaluateHeartbeat(
  state: HeartbeatState | null,
  chainSlot: bigint,
  now: Date,
  thresholds: HeartbeatThresholds,
): HeartbeatHealth {
  if (state === null) {
    return { healthy: false, reason: 'indexer has never beaten', lagSlots: null, silentForMs: null }
  }
  const lagSlots = chainSlot - state.lastProcessedSlot
  const silentForMs = now.getTime() - state.updatedAt.getTime()
  if (silentForMs > thresholds.maxSilenceMs) {
    return { healthy: false, reason: `no heartbeat for ${silentForMs}ms`, lagSlots, silentForMs }
  }
  if (lagSlots > thresholds.maxLagSlots) {
    return {
      healthy: false,
      reason: `behind the chain by ${lagSlots} slots`,
      lagSlots,
      silentForMs,
    }
  }
  return { healthy: true, reason: 'ok', lagSlots, silentForMs }
}
