import { PublicKey } from '@solana/web3.js'
import idl from './idl/eternal_word.json' with { type: 'json' }

/**
 * The synced IDL is the single source of truth for the program's ABI. Reading
 * the Program ID, the account order and the instruction discriminators from it
 * — instead of restating them here — means a rebuilt program that changes any
 * of those can never silently disagree with this client. `pnpm sync-idl` keeps
 * the file current; if it drifts, the tests that decode against it fail.
 */
export const IDL = idl

/** Program ID of the deployed program, as recorded in the IDL. */
export const PROGRAM_ID = new PublicKey(idl.address)

/** PDA seeds — numeric, never book names (docs/conventions/UBIQUITOUS_LANGUAGE.md). */
export const SEEDS = {
  config: Buffer.from('config'),
  bookRoots: Buffer.from('roots'),
  verse: Buffer.from('verse'),
} as const

/** The 8-byte Anchor discriminator of an instruction, taken from the IDL. */
export function instructionDiscriminator(name: string): Buffer {
  const instruction = idl.instructions.find((candidate) => candidate.name === name)
  if (instruction === undefined) throw new Error(`instruction not in IDL: ${name}`)
  return Buffer.from(instruction.discriminator)
}
