import { type PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js'
import { u8, u16le, u32le } from './encoding.js'
import { bookRootsPda, configPda } from './pdas.js'
import { PROGRAM_ID, instructionDiscriminator } from './program.js'

/**
 * The one-time bootstrap instructions: create the config, load every chapter
 * root, complete each book, seal. Client apps (S04) never call these — only the
 * launch runbook does (PG-07/PG-08). They live here so the encoding is tested
 * next to the register client, not hand-rolled in a script.
 *
 * Account order, writable/signer flags and discriminators all mirror the IDL.
 */

const INITIALIZE_CONFIG = instructionDiscriminator('initialize_config')
const INITIALIZE_BOOK_ROOTS = instructionDiscriminator('initialize_book_roots')
const LOAD_CHAPTER_ROOT = instructionDiscriminator('load_chapter_root')
const COMPLETE_BOOK = instructionDiscriminator('complete_book')
const SEAL = instructionDiscriminator('seal')

/** `initialize_config()` — creates the singleton config. Permissionless: the
 * commitment is a bytecode constant, so there is nothing for a caller to
 * choose. `payer` funds the account's rent. */
export function initializeConfigInstruction(
  payer: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): TransactionInstruction {
  const [config] = configPda(programId)
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: INITIALIZE_CONFIG,
  })
}

/** `initialize_book_roots(book)` — allocates one book's roots account.
 * Permissionless; `payer` funds the rent. */
export function initializeBookRootsInstruction(
  payer: PublicKey,
  book: number,
  programId: PublicKey = PROGRAM_ID,
): TransactionInstruction {
  const [config] = configPda(programId)
  const [bookRoots] = bookRootsPda(book, programId)
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: bookRoots, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([INITIALIZE_BOOK_ROOTS, u8(book)]),
  })
}

/** `load_chapter_root(book, chapter, root, proof)` — permissionless; the
 * commitment proof is what gates it, not the signer. */
export function loadChapterRootInstruction(
  signer: PublicKey,
  book: number,
  chapter: number,
  root: Uint8Array,
  proof: readonly Uint8Array[],
  programId: PublicKey = PROGRAM_ID,
): TransactionInstruction {
  if (root.length !== 32) throw new Error('root must be 32 bytes')
  const [config] = configPda(programId)
  const [bookRoots] = bookRootsPda(book, programId)
  const data = Buffer.concat([
    LOAD_CHAPTER_ROOT,
    u8(book),
    u16le(chapter),
    Buffer.from(root),
    u32le(proof.length),
    ...proof.map((sibling) => Buffer.from(sibling)),
  ])
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: bookRoots, isSigner: false, isWritable: true },
      { pubkey: signer, isSigner: true, isWritable: false },
    ],
    data,
  })
}

/** `complete_book(book)` — records a book as fully loaded. */
export function completeBookInstruction(
  signer: PublicKey,
  book: number,
  programId: PublicKey = PROGRAM_ID,
): TransactionInstruction {
  const [config] = configPda(programId)
  const [bookRoots] = bookRootsPda(book, programId)
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: bookRoots, isSigner: false, isWritable: true },
      { pubkey: signer, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([COMPLETE_BOOK, u8(book)]),
  })
}

/** `seal()` — closes the canon for good. Permissionless: it only succeeds once
 * all 66 books are complete against the hardcoded commitment. */
export function sealInstruction(
  signer: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): TransactionInstruction {
  const [config] = configPda(programId)
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: signer, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(SEAL),
  })
}
