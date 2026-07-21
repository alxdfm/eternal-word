export {
  type BookMetadata,
  BOOKS,
  BOOKS_BY_SOURCE_CODE,
  APOCRYPHA_SOURCE_CODES,
} from './books.js'
export {
  type CanonicalBook,
  type CanonicalVerse,
  CANONICAL_TEXT_DIR,
  loadCanonicalBooks,
  listRegistrableVerses,
  listOmittedPositions,
} from './dataset.js'
export {
  type Hash,
  type MerkleTree,
  buildMerkleTree,
  hashLeaf,
  hashPair,
  merkleProof,
  verifyMerkleProof,
} from './merkle.js'
export {
  type CanonicalTree,
  type ChapterTree,
  encodeVerseLeaf,
  canonicalLeaf,
  chapterKey,
  buildCanonicalTree,
  buildChapterTrees,
  buildChapterRootsTree,
  chapterRootProof,
  encodeChapterRootLeaf,
  proofForAddress,
  toHex,
} from './canonical-merkle.js'
export {
  type IntegrityReport,
  EXPECTED_BOOKS,
  EXPECTED_CHAPTERS,
  EXPECTED_REGISTRABLE_VERSES,
  EXPECTED_OMITTED,
  checkIntegrity,
} from './integrity.js'
