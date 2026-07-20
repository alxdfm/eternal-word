import {
  type ChapterTree,
  buildChapterTrees,
  listRegistrableVerses,
  loadCanonicalBooks,
  proofForAddress,
} from '@eternal-word/catalog'
import type { CanonicalBook } from '@eternal-word/catalog'
import { type VerseAddress, verseAddressKey } from '@eternal-word/domain'

/** Everything the register instruction needs about one verse. */
export interface VerseRegistrationProof {
  readonly address: VerseAddress
  /** The canonical text — the client sends it, the program proves it. */
  readonly text: string
  /** Sibling hashes, bottom layer first, against the verse's chapter root. */
  readonly proof: Buffer[]
}

/**
 * Builds registration proofs from the CanonicalText.
 *
 * The chapter trees are built once, in the constructor, so a client that
 * registers many verses pays the 31,098-leaf construction a single time. The
 * proof itself is then a map lookup plus a walk up one chapter tree.
 *
 * This is the client half of the Merkle contract: the program re-derives the
 * leaf and folds the same proof. The Rust tests (`merkle_fixtures.rs`) prove
 * the two halves agree byte for byte.
 */
export class CatalogProver {
  private readonly chapterByKey: ReadonlyMap<string, ChapterTree>
  private readonly textByKey: ReadonlyMap<string, string>

  constructor(books: readonly CanonicalBook[] = loadCanonicalBooks()) {
    const verses = listRegistrableVerses(books)
    const chapters = buildChapterTrees(verses)
    this.chapterByKey = new Map(
      chapters.map((chapter) => [`${chapter.book}:${chapter.chapter}`, chapter]),
    )
    this.textByKey = new Map(verses.map((verse) => [verseAddressKey(verse.address), verse.text]))
  }

  /** Throws if the address is not registrable — outside the canon or one of the
   * five positions the WEB leaves empty. Those have no leaf, so no proof. */
  proofFor(address: VerseAddress): VerseRegistrationProof {
    const text = this.textByKey.get(verseAddressKey(address))
    if (text === undefined) {
      throw new Error(
        `verse is not registrable: ${address.book}:${address.chapter}:${address.verse}`,
      )
    }
    const chapter = this.chapterByKey.get(`${address.book}:${address.chapter}`)
    if (chapter === undefined) {
      throw new Error(`chapter not in the canon: ${address.book}:${address.chapter}`)
    }
    return { address, text, proof: proofForAddress(chapter, address) }
  }
}
