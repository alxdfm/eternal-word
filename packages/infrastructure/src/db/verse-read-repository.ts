import type { VerseReadRepository, VerseView } from '@eternal-word/application'
import { VERSE_STATUS, type VerseAddress } from '@eternal-word/domain'
import { and, eq } from 'drizzle-orm'
import type { Database } from './client.js'
import { translations, verseTexts, verses } from './schema.js'

/**
 * Drizzle-backed {@link VerseReadRepository} — the mirror's read side. One query
 * joins the canonical text (Catálogo) with the registration row (Registro), so
 * a single round-trip answers both "what does it say" and "is it taken". A
 * `verse_texts` row with NULL text is an omitted position (not registrable); no
 * `verse_texts` row at all means the reference is not in the versification.
 */
export function createVerseReadRepository(db: Database): VerseReadRepository {
  return {
    async findByAddress(address: VerseAddress): Promise<VerseView | null> {
      const rows = await db
        .select({
          text: verseTexts.text,
          status: verses.status,
          adopter: verses.adopter,
          transaction: verses.transaction,
          account: verses.account,
          slot: verses.slot,
          registeredAt: verses.registeredAt,
        })
        .from(verseTexts)
        .innerJoin(
          translations,
          and(eq(translations.id, verseTexts.translationId), eq(translations.isCanonical, true)),
        )
        .leftJoin(
          verses,
          and(
            eq(verses.book, verseTexts.book),
            eq(verses.chapter, verseTexts.chapter),
            eq(verses.verse, verseTexts.verse),
          ),
        )
        .where(
          and(
            eq(verseTexts.book, address.book),
            eq(verseTexts.chapter, address.chapter),
            eq(verseTexts.verse, address.verse),
          ),
        )
        .limit(1)

      const row = rows[0]
      if (row === undefined) {
        return null
      }

      const registrable = row.text !== null
      return {
        address,
        text: row.text,
        registrable,
        // A registrable position with no row yet reads as AVAILABLE; an omitted
        // position carries no status.
        status: registrable ? (row.status ?? VERSE_STATUS.AVAILABLE) : null,
        adopter: row.adopter,
        transaction: row.transaction,
        account: row.account,
        slot: row.slot,
        registeredAt: row.registeredAt,
      }
    },
  }
}
