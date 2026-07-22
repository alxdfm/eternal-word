import { PublicKey } from '@solana/web3.js'
import { accountDiscriminator } from './program.js'

/**
 * Minimal decoders for the program's accounts — enough for the bootstrap to
 * resume by reading state, not by pattern-matching error strings. The byte
 * offsets mirror the Rust structs (`state.rs`); the discriminator is checked
 * first so a wrong account fails loudly instead of decoding into garbage.
 */

const CONFIG_DISCRIMINATOR = accountDiscriminator('Config')
const BOOK_ROOTS_DISCRIMINATOR = accountDiscriminator('BookRoots')
const VERSE_ACCOUNT_DISCRIMINATOR = accountDiscriminator('VerseAccount')

function checkDiscriminator(data: Buffer, expected: Buffer, name: string): void {
  if (data.length < 8 || !data.subarray(0, 8).equals(expected)) {
    throw new Error(`account data is not a ${name}`)
  }
}

export interface ConfigState {
  /** All 66 books loaded and the canon closed. Registration opens only here. */
  readonly sealed: boolean
  readonly booksComplete: number
}

/**
 * Config layout after the 8-byte discriminator:
 *   translation [8] | books_complete u8 | sealed bool | bump u8
 *
 * No authority and no commitment: the commitment is a bytecode constant and
 * the bootstrap is permissionless (see the program's constants.rs).
 */
export function decodeConfig(data: Buffer): ConfigState {
  checkDiscriminator(data, CONFIG_DISCRIMINATOR, 'Config')
  const booksComplete = data.readUInt8(8 + 8)
  const sealed = data.readUInt8(8 + 8 + 1) !== 0
  return { sealed, booksComplete }
}

export interface BookRootsState {
  readonly book: number
  readonly loaded: number
  readonly completed: boolean
  /** Whether a chapter's root is already stored — the resume skip. */
  isChapterLoaded(chapter: number): boolean
}

/**
 * BookRoots layout after the 8-byte discriminator:
 *   book u8 | loaded u16le | completed bool
 *   | loaded_mask (u32le len + bytes) | roots (u32le len + entries) | bump u8
 */
export function decodeBookRoots(data: Buffer): BookRootsState {
  checkDiscriminator(data, BOOK_ROOTS_DISCRIMINATOR, 'BookRoots')
  const book = data.readUInt8(8)
  const loaded = data.readUInt16LE(9)
  const completed = data.readUInt8(11) !== 0
  const maskLength = data.readUInt32LE(12)
  const mask = data.subarray(16, 16 + maskLength)
  return {
    book,
    loaded,
    completed,
    isChapterLoaded(chapter: number): boolean {
      const index = chapter - 1
      const byte = mask[Math.floor(index / 8)]
      return byte !== undefined && (byte & (1 << (index % 8))) !== 0
    },
  }
}

export interface VerseAccountState {
  readonly adopter: PublicKey
  readonly createdAt: bigint
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string
}

/**
 * VerseAccount layout after the 8-byte discriminator (state.rs):
 *   adopter Pubkey[32] | created_at i64 | book u8 | chapter u16le
 *   | verse u16le | text (u32le len + utf8) | bump u8
 */
export function decodeVerseAccount(data: Buffer): VerseAccountState {
  checkDiscriminator(data, VERSE_ACCOUNT_DISCRIMINATOR, 'VerseAccount')
  let offset = 8
  const adopter = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32
  const createdAt = data.readBigInt64LE(offset)
  offset += 8
  const book = data.readUInt8(offset)
  offset += 1
  const chapter = data.readUInt16LE(offset)
  offset += 2
  const verse = data.readUInt16LE(offset)
  offset += 2
  const textLength = data.readUInt32LE(offset)
  offset += 4
  const text = data.subarray(offset, offset + textLength).toString('utf8')
  return { adopter, createdAt, book, chapter, verse, text }
}
