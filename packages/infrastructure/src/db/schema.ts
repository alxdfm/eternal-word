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
  },
  (t) => [primaryKey({ columns: [t.translationId, t.book, t.chapter, t.verse] })],
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
  },
  (t) => [
    primaryKey({ columns: [t.book, t.chapter, t.verse] }),
    // Listings filter by status (explore: registered / pending / available) and
    // by adopter (a wallet's registrations) — S05 leans on both.
    index('verses_status_idx').on(t.status),
    index('verses_adopter_idx').on(t.adopter),
  ],
)
