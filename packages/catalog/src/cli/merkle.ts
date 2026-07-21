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
import { fromRepoRoot } from '@eternal-word/shared'
import {
  buildCanonicalTree,
  buildChapterRootsTree,
  buildChapterTrees,
  toHex,
} from '../canonical-merkle.js'
import { listRegistrableVerses, loadCanonicalBooks } from '../dataset.js'
import { checkIntegrity } from '../integrity.js'

const ARTIFACT_PATH = fromRepoRoot(import.meta.url, 'data/merkle-root.json')
const HASH_BYTES = 32

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

// The transaction budget used to be estimated here by adding up bytes. It was
// wrong by ~38 bytes in the direction that mattered — it omitted the 4-byte
// Borsh length prefixes on `String` and `Vec`, and guessed the envelope at 240
// bytes when the real one is 270 — which made the global tree look viable when
// it never was. Sizing now lives in `scripts/spike-pg00-transaction-budget.ts`
// (`pnpm spike:pg00`), which serializes real transactions instead of guessing.
// Keeping a second, hand-rolled estimate here is what let it drift.
// See docs/decisions/2026-07-19_forma-da-merkle-tree-e-orcamento-de-transacao.md
