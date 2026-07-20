import type { VerseAddress } from '@eternal-word/domain'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID, SEEDS } from './program.js'

/**
 * PDA derivations, mirroring the `seeds` constraints in the program exactly.
 * The byte widths matter: `book` is u8 and `chapter`/`verse` are u16 little
 * endian, the same as `chapter.to_le_bytes()` in Rust. A mismatch here would
 * derive a different address than the program expects and every transaction
 * would fail account resolution.
 */

function u8(value: number): Buffer {
  const buffer = Buffer.alloc(1)
  buffer.writeUInt8(value, 0)
  return buffer
}

function u16le(value: number): Buffer {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

/** The single config account: PDA of fixed seeds (risk R3). */
export function configPda(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.config], programId)
}

/** The chapter-roots account for one book. */
export function bookRootsPda(book: number, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.bookRoots, u8(book)], programId)
}

/** The account that will hold a registered verse. Its non-existence is what
 * makes the verse available; its existence is the registration. */
export function versePda(
  address: VerseAddress,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.verse, u8(address.book), u16le(address.chapter), u16le(address.verse)],
    programId,
  )
}
