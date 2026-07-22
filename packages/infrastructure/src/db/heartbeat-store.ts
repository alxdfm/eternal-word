import type { HeartbeatState, HeartbeatStore } from '@eternal-word/application'
import { eq } from 'drizzle-orm'
import type { Database } from './client.js'
import { syncHeartbeat } from './schema.js'

// One row, always id 1 — the indexer's single heartbeat.
const ROW_ID = 1

/** Drizzle-backed {@link HeartbeatStore}. */
export function createHeartbeatStore(db: Database): HeartbeatStore {
  return {
    async read(): Promise<HeartbeatState | null> {
      const [row] = await db.select().from(syncHeartbeat).where(eq(syncHeartbeat.id, ROW_ID))
      if (row === undefined) return null
      return { lastProcessedSlot: row.lastProcessedSlot, updatedAt: row.updatedAt }
    },
    async write(lastProcessedSlot: bigint): Promise<void> {
      const updatedAt = new Date()
      await db
        .insert(syncHeartbeat)
        .values({ id: ROW_ID, lastProcessedSlot, updatedAt })
        .onConflictDoUpdate({ target: syncHeartbeat.id, set: { lastProcessedSlot, updatedAt } })
    },
  }
}
