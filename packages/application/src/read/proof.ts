import {
  type CanonicalVerse,
  buildCanonicalTree,
  proofForAddress,
  toHex,
} from '@eternal-word/catalog'
import { createVerseAddress } from '@eternal-word/domain'
import { isErr } from '@eternal-word/shared'
import type { ChapterTextReader } from './chapter-reader.js'

/**
 * Result of building a registration proof. `ok` carries the canonical text and
 * the sibling hashes (hex) the client folds into the `register_verse` data;
 * `not-registrable` is an omitted/absent verse; `invalid` is out of the
 * canonical range. HTTP mapping lives in apps/api.
 */
export type RegistrationProofResult =
  | { readonly kind: 'ok'; readonly text: string; readonly proof: string[] }
  | { readonly kind: 'not-registrable' }
  | { readonly kind: 'invalid'; readonly reason: string }

/**
 * Builds the chapter-scoped Merkle proof for one verse from the chapter's text.
 * The chapter tree reconstructed here is byte-identical to the one the Catalog
 * builds (same leaves, same canonical order), so the proof verifies against the
 * committed root the program checks — see ADR
 * 2026-07-24_proof-servida-pela-lambda.md.
 */
export async function buildRegistrationProof(
  reader: ChapterTextReader,
  book: number,
  chapter: number,
  verse: number,
): Promise<RegistrationProofResult> {
  const address = createVerseAddress(book, chapter, verse)
  if (isErr(address)) {
    return { kind: 'invalid', reason: address.error }
  }

  const chapterVerses = await reader.listChapter(book, chapter)
  const target = chapterVerses.find((entry) => entry.verse === verse)
  if (target === undefined) {
    // Omitted position, or a verse number the chapter does not have.
    return { kind: 'not-registrable' }
  }

  const canonicalVerses: CanonicalVerse[] = chapterVerses.map((entry) => ({
    address: { book, chapter, verse: entry.verse },
    text: entry.text,
  }))
  const proof = proofForAddress(buildCanonicalTree(canonicalVerses), address.data).map(toHex)
  return { kind: 'ok', text: target.text, proof }
}
