/**
 * Runs against the committed CanonicalText. These tests are the guarantee
 * that what we register on-chain is exactly what the repository says — and
 * that anyone can rebuild it.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BOOKS,
  EXPECTED_CHAPTERS,
  EXPECTED_OMITTED,
  EXPECTED_REGISTRABLE_VERSES,
  buildCanonicalTree,
  buildChapterTrees,
  canonicalLeaf,
  checkIntegrity,
  listOmittedPositions,
  listRegistrableVerses,
  loadCanonicalBooks,
  proofForAddress,
  toHex,
  verifyMerkleProof,
} from '../src/index.js'

const books = loadCanonicalBooks()
const verses = listRegistrableVerses(books)

describe('book table', () => {
  it('matches the dataset book by book', () => {
    expect(BOOKS).toHaveLength(66)
    books.forEach((book, position) => {
      const metadata = BOOKS[position]
      expect(metadata?.book).toBe(book.book)
      expect(metadata?.name).toBe(book.name)
      expect(metadata?.abbreviation).toBe(book.abbreviation)
      expect(metadata?.testament).toBe(book.testament)
    })
  })

  it('carries no duplicate slug or source code', () => {
    expect(new Set(BOOKS.map((book) => book.slug)).size).toBe(66)
    expect(new Set(BOOKS.map((book) => book.sourceCode)).size).toBe(66)
  })
})

describe('committed dataset', () => {
  it('holds the whole protestant canon', () => {
    const report = checkIntegrity(books)
    expect(report.problems).toEqual([])
    expect(report.books).toBe(66)
    expect(report.chapters).toBe(EXPECTED_CHAPTERS)
    expect(report.registrableVerses).toBe(EXPECTED_REGISTRABLE_VERSES)
  })

  it('omits exactly the five positions the WEB leaves without text', () => {
    const omitted = listOmittedPositions(books).map((a) => `${a.book}:${a.chapter}:${a.verse}`)
    expect(omitted).toEqual(EXPECTED_OMITTED.map((a) => `${a.book}:${a.chapter}:${a.verse}`))
  })

  it('opens at Genesis 1:1 and closes at Revelation 22:21', () => {
    const first = verses[0]
    const last = verses[verses.length - 1]
    expect(first?.address).toEqual({ book: 1, chapter: 1, verse: 1 })
    expect(first?.text).toBe('In the beginning, God created the heavens and the earth.')
    expect(last?.address).toEqual({ book: 66, chapter: 22, verse: 21 })
  })

  it('carries no empty or whitespace-only text', () => {
    expect(verses.filter((verse) => verse.text.trim() === '')).toEqual([])
  })
})

describe('merkle commitment', () => {
  // Hoisted: rebuilding these hashes all 31,098 verses again.
  const tree = buildCanonicalTree(verses)
  const chapters = buildChapterTrees(verses)

  it('reproduces the committed root exactly', () => {
    const artifact = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../../../data/merkle-root.json', import.meta.url)),
        'utf8',
      ),
    )
    expect(toHex(tree.tree.root)).toBe(artifact.global.root)
    expect(artifact.counts.registrableVerses).toBe(EXPECTED_REGISTRABLE_VERSES)
  })

  it('proves the first, the last and the longest verse', () => {
    const longest = verses.reduce((longest, verse) =>
      Buffer.byteLength(verse.text, 'utf8') > Buffer.byteLength(longest.text, 'utf8')
        ? verse
        : longest,
    )

    for (const verse of [verses[0], verses[verses.length - 1], longest]) {
      if (verse === undefined) throw new Error('dataset is empty')
      const proof = proofForAddress(tree, verse.address)
      expect(
        verifyMerkleProof(canonicalLeaf(verse), proof, tree.tree.root),
        `${verse.address.book}:${verse.address.chapter}:${verse.address.verse}`,
      ).toBe(true)
    }
  })

  it('has no leaf for an omitted position', () => {
    for (const address of EXPECTED_OMITTED) {
      expect(() => proofForAddress(tree, address)).toThrow(/not registrable/)
    }
  })

  it('keeps the proof within the transaction budget in the per-chapter shape', () => {
    // Spike PG-00 settled risk R1: the global tree does not fit at all, the
    // per-chapter shape leaves 234 bytes spare. This depth is the number the
    // decision rests on — PG-05 caps the on-chain proof at these 8 siblings.
    const maxDepth = chapters.reduce((max, chapter) => Math.max(max, chapter.tree.depth), 0)
    expect(chapters).toHaveLength(EXPECTED_CHAPTERS)
    expect(maxDepth).toBeLessThanOrEqual(8)
  })

  it('proves a verse inside its own chapter tree', () => {
    const psalm119 = chapters.find((chapter) => chapter.book === 19 && chapter.chapter === 119)
    if (psalm119 === undefined) throw new Error('Psalm 119 missing from the dataset')

    expect(psalm119.verses).toHaveLength(176)
    for (const verse of psalm119.verses) {
      const proof = proofForAddress(psalm119, verse.address)
      expect(verifyMerkleProof(canonicalLeaf(verse), proof, psalm119.tree.root)).toBe(true)
    }
  })
})
