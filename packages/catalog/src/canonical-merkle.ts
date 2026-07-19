import type { VerseAddress } from '@eternal-word/domain'
import type { CanonicalVerse } from './dataset.js'
import { type Hash, type MerkleTree, buildMerkleTree, hashLeaf, merkleProof } from './merkle.js'

/**
 * Leaf payload — the exact byte layout the Anchor program must rebuild to
 * verify a registration. Every field is fixed-width or length-prefixed so
 * no two different verses can ever encode to the same bytes.
 *
 *   book      u8
 *   chapter   u16 little-endian
 *   verse     u16 little-endian
 *   text_len  u32 little-endian
 *   text      utf-8 bytes
 */
export function encodeVerseLeaf(address: VerseAddress, text: string): Buffer {
  const textBytes = Buffer.from(text, 'utf8')
  const header = Buffer.alloc(9)
  header.writeUInt8(address.book, 0)
  header.writeUInt16LE(address.chapter, 1)
  header.writeUInt16LE(address.verse, 3)
  header.writeUInt32LE(textBytes.length, 5)
  return Buffer.concat([header, textBytes])
}

export function canonicalLeaf(verse: CanonicalVerse): Hash {
  return hashLeaf(encodeVerseLeaf(verse.address, verse.text))
}

export function chapterKey(book: number, chapter: number): string {
  return `${book}:${chapter}`
}

export interface CanonicalTree {
  readonly tree: MerkleTree
  readonly verses: readonly CanonicalVerse[]
  /** Leaf index by verse address key, so proofs are O(1) to locate. */
  readonly indexByAddress: ReadonlyMap<string, number>
}

function indexVerses(verses: readonly CanonicalVerse[]): ReadonlyMap<string, number> {
  const index = new Map<string, number>()
  verses.forEach((verse, position) => {
    index.set(`${verse.address.book}:${verse.address.chapter}:${verse.address.verse}`, position)
  })
  return index
}

/** Single tree over every registrable verse, in canonical order. */
export function buildCanonicalTree(verses: readonly CanonicalVerse[]): CanonicalTree {
  const tree = buildMerkleTree(verses.map(canonicalLeaf))
  return { tree, verses, indexByAddress: indexVerses(verses) }
}

export interface ChapterTree extends CanonicalTree {
  readonly book: number
  readonly chapter: number
}

/**
 * One tree per chapter. Keeps proofs short — the largest chapter (Psalm 119,
 * 176 verses) needs 8 siblings instead of the 15 a single global tree
 * requires. The 1,189 roots live in a config account, which costs nothing in
 * the transaction because an account travels as an address, not as data.
 * See risk R1 and spike PG-00.
 */
export function buildChapterTrees(verses: readonly CanonicalVerse[]): ChapterTree[] {
  const grouped = new Map<string, CanonicalVerse[]>()
  const order: { book: number; chapter: number; key: string }[] = []

  for (const verse of verses) {
    const key = chapterKey(verse.address.book, verse.address.chapter)
    let bucket = grouped.get(key)
    if (bucket === undefined) {
      bucket = []
      grouped.set(key, bucket)
      order.push({ book: verse.address.book, chapter: verse.address.chapter, key })
    }
    bucket.push(verse)
  }

  return order.map(({ book, chapter, key }) => {
    const chapterVerses = grouped.get(key) ?? []
    const tree = buildMerkleTree(chapterVerses.map(canonicalLeaf))
    return {
      book,
      chapter,
      tree,
      verses: chapterVerses,
      indexByAddress: indexVerses(chapterVerses),
    }
  })
}

/** Commitment over the chapter roots, so a single 32-byte value still
 * fixes the whole CanonicalText even in the per-chapter design. */
export function buildChapterRootsTree(chapters: readonly ChapterTree[]): MerkleTree {
  return buildMerkleTree(chapters.map((chapter) => chapter.tree.root))
}

export function proofForAddress(source: CanonicalTree, address: VerseAddress): Hash[] {
  const key = `${address.book}:${address.chapter}:${address.verse}`
  const index = source.indexByAddress.get(key)
  if (index === undefined) throw new Error(`verse is not registrable: ${key}`)
  return merkleProof(source.tree, index)
}

export function toHex(hash: Hash): string {
  return hash.toString('hex')
}
