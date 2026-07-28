// Drizzle schema — the off-chain mirror. Four tables, exactly as
// docs/decisions/2026-07-18_modelo-de-dados-off-chain.md:
//   translations, verse_texts (Catálogo) · books (shared) · verses (Registro).
// Enum values come from @eternal-word/domain so the DB never drifts from the
// domain language (VERSE_STATUS, TESTAMENT).
import { TESTAMENT, VERSE_STATUS } from '@eternal-word/domain'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  customType,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  smallserial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Postgres `tsvector` — drizzle has no native type; used only for the
 * full-text search column and its GIN index (never selected directly). */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

export const testament = pgEnum('testament', [TESTAMENT.OLD, TESTAMENT.NEW])
export const verseStatus = pgEnum('verse_status', [
  VERSE_STATUS.AVAILABLE,
  VERSE_STATUS.PENDING,
  VERSE_STATUS.REGISTERED,
  VERSE_STATUS.FAILED,
])

/** Catálogo: the translations available for reading. */
export const translations = pgTable(
  'translations',
  {
    id: smallserial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    language: text('language').notNull(),
    license: text('license').notNull(),
    sourceUrl: text('source_url').notNull(),
    isCanonical: boolean('is_canonical').notNull().default(false),
  },
  (t) => [
    uniqueIndex('translations_code_key').on(t.code),
    // At most one canonical translation — the one registered on-chain. All TRUE
    // rows share the same key, so a second canonical would collide.
    uniqueIndex('translations_single_canonical')
      .on(t.isCanonical)
      .where(sql`${t.isCanonical}`),
  ],
)

/** Shared by both contexts. `id` is the 1-66 index used in PDA seeds. */
export const books = pgTable(
  'books',
  {
    id: smallint('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    abbreviation: text('abbreviation').notNull(),
    testament: testament('testament').notNull(),
    chaptersCount: smallint('chapters_count').notNull(),
  },
  (t) => [uniqueIndex('books_slug_key').on(t.slug)],
)

/** Catálogo: the text itself, per translation. `text` NULL marks a position
 * omitted in the translation (5 in the WEB) — present in the numbering, not
 * registrable. */
export const verseTexts = pgTable(
  'verse_texts',
  {
    translationId: smallint('translation_id')
      .notNull()
      .references(() => translations.id),
    book: smallint('book')
      .notNull()
      .references(() => books.id),
    chapter: smallint('chapter').notNull(),
    verse: smallint('verse').notNull(),
    text: text('text'),
    // Full-text search (EX-03, D1). Stored generated column + GIN index, so a
    // text search is an index lookup — never an ILIKE scan of 31k rows. NULL
    // (omitted) positions produce an empty vector and match nothing.
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      // `simple` (not `english`): keeps stop-words like "the"/"you" searchable
      // (UX-02). The query in search-repository.ts must use `simple` too. Trade-off:
      // no stemming (e.g. "run" won't match "running") — acceptable for verse
      // lookups, where exact words (incl. common ones) matter more.
      sql`to_tsvector('simple', coalesce(text, ''))`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.translationId, t.book, t.chapter, t.verse] }),
    index('verse_texts_search_idx').using('gin', t.searchVector),
  ],
)

/** Registro: a 1:1 mirror of the on-chain VerseAccount. One row per registrable
 * position (31,098). `adopter` is never named `owner` (glossário). `slot` and
 * `registered_at` come from the confirmation; the indexer fills them. */
export const verses = pgTable(
  'verses',
  {
    book: smallint('book')
      .notNull()
      .references(() => books.id),
    chapter: smallint('chapter').notNull(),
    verse: smallint('verse').notNull(),
    status: verseStatus('status').notNull().default(VERSE_STATUS.AVAILABLE),
    adopter: text('adopter'),
    transaction: text('transaction'),
    account: text('account'),
    slot: bigint('slot', { mode: 'bigint' }),
    registeredAt: timestamp('registered_at', { withTimezone: true }),
    // Touched on every status write, so PENDING age-out (camada 2) has a clock.
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.book, t.chapter, t.verse] }),
    // Listings filter by status (explore: registered / pending / available) and
    // by adopter (a wallet's registrations) — S05 leans on both.
    index('verses_status_idx').on(t.status),
    index('verses_adopter_idx').on(t.adopter),
  ],
)

/** Single-row liveness marker the reconciliation loop stamps each cycle. An
 * external monitor reads it to tell a stopped indexer from a merely quiet one
 * (R4) — a plain health check cannot. */
export const syncHeartbeat = pgTable('sync_heartbeat', {
  id: smallint('id').primaryKey(),
  lastProcessedSlot: bigint('last_processed_slot', { mode: 'bigint' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
