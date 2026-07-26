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
export type { VerseView } from './read/verse-view.js'
export type { VerseReadRepository } from './read/ports.js'
export { type VerseLookup, lookupVerse } from './read/use-cases.js'
export type { ChapterTextReader, ChapterVerseText } from './read/chapter-reader.js'
export { type RegistrationProofResult, buildRegistrationProof } from './read/proof.js'
export { type MarkPendingResult, markPendingRequest } from './write/pending.js'
export type {
  BookProgress,
  ChapterProgress,
  DashboardAggregates,
  DashboardStats,
  DayCount,
  ListFilter,
  Paginated,
  TrendPoint,
  VerseListItem,
} from './read/read-model.js'
export { LIST_FILTERS, isListFilter } from './read/read-model.js'
export type { AggregateReadRepository } from './read/aggregate-ports.js'
export {
  type ChapterProgressResult,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getBookProgress,
  getChapterProgress,
  getDashboard,
  listVerses,
  toCumulativeTrend,
} from './read/aggregate-use-cases.js'
export { estimateSol } from './read/sol-estimate.js'
export type { SearchHit, SearchRepository } from './read/search.js'
export { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, searchVerses } from './read/search.js'
