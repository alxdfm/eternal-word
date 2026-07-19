//
// Spike PG-00 — transaction budget and Merkle tree shape.
//
// Blocks all of sprint S02 (sprints/2026-S02/tasks.md) and resolves risk R1
// in sprints/ROADMAP.md: the worst-case registration transaction was estimated
// at ~1,226 of the 1,232-byte limit, leaving no room for a ComputeBudget
// instruction.
//
// `pnpm catalog:merkle` already prints an estimate, but it *adds up bytes* —
// it omits Borsh length prefixes and guesses the envelope at a flat 240 bytes.
// This spike instead builds and serializes real transactions with
// @solana/web3.js, so the numbers below are wire sizes, not arithmetic.
//
// Not measured here: compute units and config-account rent. Those need the
// deployed program (PG-01/PG-02) and get measured on devnet in PG-08.
//
//   pnpm spike:pg00
//
import {
  type CanonicalVerse,
  type ChapterTree,
  buildCanonicalTree,
  buildChapterTrees,
  listRegistrableVerses,
  loadCanonicalBooks,
  proofForAddress,
} from '@eternal-word/catalog'
import type { VerseAddress } from '@eternal-word/domain'
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

const TRANSACTION_LIMIT = 1232
/** Deterministic stand-ins — every pubkey is 32 bytes, so only validity matters,
 * not which key it is. Seeded so the numbers reproduce byte for byte. */
const PROGRAM_ID = Keypair.fromSeed(new Uint8Array(32).fill(7)).publicKey
/** Stand-in for the adopter's wallet: fee payer and sole signer. */
const ADOPTER = Keypair.fromSeed(new Uint8Array(32).fill(9)).publicKey
const BLOCKHASH = PublicKey.default.toBase58()

/**
 * Borsh encoding of `register_verse(book, chapter, verse, text, proof)` as
 * Anchor lays it out on the wire. The 4-byte length prefixes on `String` and
 * `Vec<[u8; 32]>` are exactly what the byte-sum estimate forgot.
 */
function encodeRegisterVerse(
  address: VerseAddress,
  text: string,
  proof: readonly Buffer[],
): Buffer {
  const textBytes = Buffer.from(text, 'utf8')
  const discriminator = Buffer.alloc(8) // anchor: sha256("global:register_verse")[..8]
  const args = Buffer.alloc(5)
  args.writeUInt8(address.book, 0)
  args.writeUInt16LE(address.chapter, 1)
  args.writeUInt16LE(address.verse, 3)

  const textLen = Buffer.alloc(4)
  textLen.writeUInt32LE(textBytes.length, 0)

  const proofLen = Buffer.alloc(4)
  proofLen.writeUInt32LE(proof.length, 0)

  return Buffer.concat([discriminator, args, textLen, textBytes, proofLen, ...proof])
}

/** Account list of `register_verse`, with both PDAs derived for real. */
function registerVerseAccounts(address: VerseAddress) {
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID)
  const book = Buffer.alloc(1)
  book.writeUInt8(address.book, 0)
  const chapter = Buffer.alloc(2)
  chapter.writeUInt16LE(address.chapter, 0)
  const verse = Buffer.alloc(2)
  verse.writeUInt16LE(address.verse, 0)
  const [verseAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('verse'), book, chapter, verse],
    PROGRAM_ID,
  )

  return [
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: verseAccount, isSigner: false, isWritable: true },
    { pubkey: ADOPTER, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
}

/** Legacy transactions carry signature placeholders that compileMessage omits. */
function legacySize(instructions: TransactionInstruction[]): number {
  const transaction = new Transaction({ feePayer: ADOPTER, recentBlockhash: BLOCKHASH })
  transaction.add(...instructions)
  const message = transaction.compileMessage()
  // 1 byte of compact-u16 signature count (always < 128 signers here) + 64 per signature.
  return 1 + 64 * message.header.numRequiredSignatures + message.serialize().length
}

/**
 * VersionedTransaction zero-fills signatures, so serialize() is the wire size.
 *
 * Returns null when web3.js refuses to serialize: MessageV0.serialize encodes
 * into a Buffer of exactly PACKET_DATA_SIZE (1232) and throws RangeError on
 * overrun. That refusal is itself the answer — the transaction does not fit.
 * (Legacy Message.serialize uses a 2048-byte scratch buffer, so it happily
 * returns oversized numbers; that is why both paths are measured.)
 */
function versionedSize(instructions: TransactionInstruction[]): number | null {
  const message = new TransactionMessage({
    payerKey: ADOPTER,
    recentBlockhash: BLOCKHASH,
    instructions,
  }).compileToV0Message()
  try {
    return new VersionedTransaction(message).serialize().length
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}

const COMPUTE_BUDGET = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
]

function measure(label: string, address: VerseAddress, text: string, proof: readonly Buffer[]) {
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: registerVerseAccounts(address),
    data: encodeRegisterVerse(address, text, proof),
  })

  const rows: [string, number | null][] = [
    ['legacy, no ComputeBudget', legacySize([instruction])],
    ['legacy + ComputeBudget', legacySize([...COMPUTE_BUDGET, instruction])],
    ['v0, no ComputeBudget', versionedSize([instruction])],
    ['v0 + ComputeBudget', versionedSize([...COMPUTE_BUDGET, instruction])],
  ]

  process.stdout.write(`\n${label}\n`)
  process.stdout.write(
    `  proof: ${proof.length} siblings (${proof.length * 32} B) | instruction data: ${instruction.data.length} B\n`,
  )
  for (const [name, size] of rows) {
    if (size === null) {
      process.stdout.write(`  ${name.padEnd(26)}     — B   REJECTED by web3.js (exceeds 1232)\n`)
      continue
    }
    const margin = TRANSACTION_LIMIT - size
    const verdict = margin >= 0 ? `${margin} B spare` : `OVER by ${-margin} B`
    process.stdout.write(`  ${name.padEnd(26)} ${String(size).padStart(5)} B   ${verdict}\n`)
  }
}

const books = loadCanonicalBooks()
const verses = listRegistrableVerses(books)
const chapterTrees = buildChapterTrees(verses)

/** Chapter lookup is needed once per measurement and once per verse in the
 * sweep below — 31,098 linear scans over 1,189 chapters if done with `find`. */
const chapterByAddress = new Map(
  chapterTrees.map((tree) => [`${tree.book}:${tree.chapter}`, tree] as const),
)

function chapterFor(verse: VerseAddress): ChapterTree {
  const tree = chapterByAddress.get(`${verse.book}:${verse.chapter}`)
  if (tree === undefined) throw new Error(`chapter tree missing for ${verse.book}:${verse.chapter}`)
  return tree
}

const longest = verses.reduce((worst, verse) =>
  Buffer.byteLength(verse.text, 'utf8') > Buffer.byteLength(worst.text, 'utf8') ? verse : worst,
)
const { address, text } = longest

process.stdout.write(
  `${[
    'Spike PG-00 — real serialized transactions (not byte arithmetic)',
    `limit: ${TRANSACTION_LIMIT} B`,
    `worst-case verse: ${address.book}:${address.chapter}:${address.verse} — ${Buffer.byteLength(text, 'utf8')} B of text`,
  ].join('\n')}\n`,
)

const globalTree = buildCanonicalTree(verses)
measure(
  '(a) global tree — one root over all 31,098 verses',
  address,
  text,
  proofForAddress(globalTree, address),
)

/**
 * Which verse actually costs the most in design (b).
 *
 * The longest verse and the deepest chapter are different verses — Esther 8
 * holds the 493-byte verse but is only 5 levels deep, while Psalm 119 is 8
 * levels deep with short verses. Sizing (b) off "longest text + deepest tree"
 * measures a verse that does not exist. The number that matters is the maximum
 * over every registrable verse of its own text plus its own chapter's proof.
 */
function chapterShapeCost(verse: CanonicalVerse): number {
  return Buffer.byteLength(verse.text, 'utf8') + chapterFor(verse.address).tree.depth * 32
}

let worstForChapterShape = verses[0]
if (worstForChapterShape === undefined) throw new Error('CanonicalText has no registrable verses')
let worstCost = chapterShapeCost(worstForChapterShape)
for (const verse of verses) {
  // Only the candidate is measured — the incumbent's cost is already known,
  // so the sweep does one pass of work instead of two.
  const cost = chapterShapeCost(verse)
  if (cost > worstCost) {
    worstCost = cost
    worstForChapterShape = verse
  }
}

measure(
  '(b) per-chapter tree — 1,189 roots in the config account',
  worstForChapterShape.address,
  worstForChapterShape.text,
  proofForAddress(chapterFor(worstForChapterShape.address), worstForChapterShape.address),
)

const deepest = chapterTrees.reduce((worst, candidate) =>
  candidate.tree.depth > worst.tree.depth ? candidate : worst,
)

// The sweep is what proves the (b) row above is really the worst case, so its
// conclusion is reported rather than re-printing an identical table.
process.stdout.write(
  [
    '',
    `deepest chapter:    ${deepest.book}:${deepest.chapter} — ${deepest.verses.length} verses, depth ${deepest.tree.depth}`,
    `costliest verse:    ${worstForChapterShape.address.book}:${worstForChapterShape.address.chapter}:${worstForChapterShape.address.verse}`,
    `                    (swept all ${verses.length} verses: text + own chapter proof)`,
    '',
  ].join('\n'),
)
