import type { MirrorEntry, VerseRegistered, VerseRepository } from '@eternal-word/application'
import { VERSE_STATUS, type VerseAddress } from '@eternal-word/domain'
import { and, eq, lt, ne } from 'drizzle-orm'
import type { Database } from './client.js'
import { verses } from './schema.js'

const at = (address: VerseAddress) =>
  and(
    eq(verses.book, address.book),
    eq(verses.chapter, address.chapter),
    eq(verses.verse, address.verse),
  )

/** Drizzle-backed {@link VerseRepository} — the mirror's write side. */
export function createVerseRepository(db: Database): VerseRepository {
  return {
    async recordRegistered(event: VerseRegistered): Promise<void> {
      const base = {
        status: VERSE_STATUS.REGISTERED,
        adopter: event.adopter,
        account: event.account,
        slot: event.slot,
        registeredAt: event.registeredAt,
        updatedAt: new Date(),
      }
      // A reconciliation read carries no signature (null); keep whatever the row
      // already has rather than nulling a real-time capture.
      const set = event.transaction === null ? base : { ...base, transaction: event.transaction }
      // Upsert: the seed makes the row exist, but recording stays idempotent
      // even against a fresh mirror. REGISTERED is terminal, so a repeat is
      // effectively a no-op.
      await db
        .insert(verses)
        .values({
          book: event.address.book,
          chapter: event.address.chapter,
          verse: event.address.verse,
          transaction: event.transaction,
          ...base,
        })
        .onConflictDoUpdate({ target: [verses.book, verses.chapter, verses.verse], set })
    },

    async markPending(address: VerseAddress, transaction: string): Promise<void> {
      // Only AVAILABLE → PENDING (the domain's one entry into PENDING); a
      // terminal REGISTERED is never touched.
      await db
        .update(verses)
        .set({ status: VERSE_STATUS.PENDING, transaction, updatedAt: new Date() })
        .where(and(at(address), eq(verses.status, VERSE_STATUS.AVAILABLE)))
    },

    async failStalePending(cutoff: Date): Promise<VerseAddress[]> {
      return db
        .update(verses)
        .set({ status: VERSE_STATUS.FAILED, updatedAt: new Date() })
        .where(and(eq(verses.status, VERSE_STATUS.PENDING), lt(verses.updatedAt, cutoff)))
        .returning({ book: verses.book, chapter: verses.chapter, verse: verses.verse })
    },

    async listNonAvailable(): Promise<MirrorEntry[]> {
      const rows = await db
        .select({
          book: verses.book,
          chapter: verses.chapter,
          verse: verses.verse,
          status: verses.status,
        })
        .from(verses)
        .where(ne(verses.status, VERSE_STATUS.AVAILABLE))
      return rows.map((row) => ({
        address: { book: row.book, chapter: row.chapter, verse: row.verse },
        status: row.status,
      }))
    },

    async releaseToAvailable(address: VerseAddress): Promise<void> {
      await db
        .update(verses)
        .set({
          status: VERSE_STATUS.AVAILABLE,
          adopter: null,
          transaction: null,
          account: null,
          slot: null,
          registeredAt: null,
          updatedAt: new Date(),
        })
        .where(at(address))
    },
  }
}
