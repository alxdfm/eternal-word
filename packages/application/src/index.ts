// Sync core — ports and use cases for the three-layer indexer. Pure: no driver,
// no AWS. Adapters (Drizzle, logsSubscribe, Helius, getProgramAccounts) live in
// infrastructure/api and are wired in the IX tasks.
export type { VerseRegistered } from './sync/events.js'
export type {
  ChainReader,
  EventSource,
  MirrorEntry,
  Unsubscribe,
  VerseRepository,
} from './sync/ports.js'
export {
  type ReconcileReport,
  expirePending,
  markPending,
  recordRegistered,
  reconcile,
} from './sync/use-cases.js'
export {
  type HeartbeatState,
  type HeartbeatStore,
  type HeartbeatThresholds,
  type HeartbeatHealth,
  evaluateHeartbeat,
} from './sync/heartbeat.js'
