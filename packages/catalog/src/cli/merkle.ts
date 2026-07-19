/**
 * Builds the Merkle commitment over the CanonicalText and writes it to
 * data/merkle-root.json.
 *
 *   pnpm catalog:merkle           regenerates the artifact
 *   pnpm catalog:merkle --check   fails if it differs from the committed one
 *
 * The `--check` mode runs in CI and is the guarantee that anyone can rebuild
 * the exact root we register on-chain — the basis of the project's public
 * auditability.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildCanonicalTree,
  buildChapterRootsTree,
  buildChapterTrees,
  toHex,
} from '../canonical-merkle.js'
import { listRegistrableVerses, loadCanonicalBooks } from '../dataset.js'
import { checkIntegrity } from '../integrity.js'

const ARTIFACT_PATH = fileURLToPath(new URL('../../../../data/merkle-root.json', import.meta.url))
const HASH_BYTES = 32
const SOLANA_TRANSACTION_LIMIT = 1232
/** Signatures, message header, account keys and blockhash — everything in a
 * registration transaction that is not the instruction payload. */
const TRANSACTION_OVERHEAD = 240

const books = loadCanonicalBooks()
const integrity = checkIntegrity(books)
if (integrity.problems.length > 0) {
  process.stderr.write('refusing to build Merkle tree over an invalid dataset:\n')
  for (const problem of integrity.problems) process.stderr.write(`  - ${problem}\n`)
  process.exit(1)
}

const verses = listRegistrableVerses(books)
const global = buildCanonicalTree(verses)
const chapters = buildChapterTrees(verses)
const chapterRoots = buildChapterRootsTree(chapters)

const maxChapterDepth = chapters.reduce((max, chapter) => Math.max(max, chapter.tree.depth), 0)
const longestVerse = verses.reduce((longest, verse) =>
  Buffer.byteLength(verse.text, 'utf8') > Buffer.byteLength(longest.text, 'utf8') ? verse : longest,
)
const longestVerseBytes = Buffer.byteLength(longestVerse.text, 'utf8')

const artifact = {
  translation: 'engwebp',
  algorithm: {
    hash: 'sha256',
    leafPrefix: '0x00',
    nodePrefix: '0x01',
    pairOrder: 'sorted',
    oddNode: 'promoted',
    leafEncoding: 'book:u8 | chapter:u16le | verse:u16le | textLen:u32le | text:utf8',
  },
  counts: {
    books: integrity.books,
    chapters: integrity.chapters,
    registrableVerses: integrity.registrableVerses,
  },
  global: {
    root: toHex(global.tree.root),
    depth: global.tree.depth,
    proofBytes: global.tree.depth * HASH_BYTES,
  },
  perChapter: {
    rootsCommitment: toHex(chapterRoots.root),
    chapterCount: chapters.length,
    maxDepth: maxChapterDepth,
    maxProofBytes: maxChapterDepth * HASH_BYTES,
    roots: chapters.map((chapter) => ({
      book: chapter.book,
      chapter: chapter.chapter,
      verses: chapter.verses.length,
      root: toHex(chapter.tree.root),
    })),
  },
}

const serialized = `${JSON.stringify(artifact, null, 2)}\n`

if (process.argv.includes('--check')) {
  const committed = readFileSync(ARTIFACT_PATH, 'utf8')
  if (committed !== serialized) {
    process.stderr.write(
      'Merkle artifact does not match the committed one.\n' +
        'The CanonicalText or the tree construction changed — this alters what is canonical.\n' +
        'Run `pnpm catalog:merkle` and review the diff deliberately.\n',
    )
    process.exit(1)
  }
  process.stdout.write(`Merkle artifact reproducible — root ${artifact.global.root}\n`)
} else {
  writeFileSync(ARTIFACT_PATH, serialized)
  process.stdout.write(`wrote ${ARTIFACT_PATH}\n`)
}

// Transaction budget — input for spike PG-00 (risk R1 in sprints/ROADMAP.md).
const instructionOverhead = 8 + 5 // anchor discriminator + book/chapter/verse args
const globalWorstCase = longestVerseBytes + global.tree.depth * HASH_BYTES + instructionOverhead
const chapterWorstCase = longestVerseBytes + maxChapterDepth * HASH_BYTES + instructionOverhead

process.stdout.write(
  [
    '',
    'transaction budget (worst case)',
    `  longest verse:        ${longestVerse.address.book}:${longestVerse.address.chapter}:${longestVerse.address.verse} — ${longestVerseBytes} bytes`,
    `  global tree:          instruction ${globalWorstCase} B -> transaction ~${globalWorstCase + TRANSACTION_OVERHEAD} B of ${SOLANA_TRANSACTION_LIMIT}`,
    `  per-chapter tree:     instruction ${chapterWorstCase} B -> transaction ~${chapterWorstCase + TRANSACTION_OVERHEAD} B of ${SOLANA_TRANSACTION_LIMIT}`,
    '',
  ].join('\n'),
)
