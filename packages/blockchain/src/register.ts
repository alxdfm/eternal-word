import type { VerseAddress } from '@eternal-word/domain'
import {
  ComputeBudgetProgram,
  type PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { u8, u16le, u32le } from './encoding.js'
import { bookRootsPda, configPda, versePda } from './pdas.js'
import { PROGRAM_ID, instructionDiscriminator } from './program.js'

const REGISTER_VERSE = instructionDiscriminator('register_verse')

/**
 * Borsh encoding of `register_verse(book, chapter, verse, text, proof)`,
 * matching how Anchor lays the arguments on the wire. The 4-byte length
 * prefixes on `String` and `Vec` are load-bearing — they are what the PG-00
 * budget measurement accounts for.
 */
export function encodeRegisterVerse(
  address: VerseAddress,
  text: string,
  proof: readonly Uint8Array[],
): Buffer {
  const textBytes = Buffer.from(text, 'utf8')
  return Buffer.concat([
    REGISTER_VERSE,
    u8(address.book),
    u16le(address.chapter),
    u16le(address.verse),
    u32le(textBytes.length),
    textBytes,
    u32le(proof.length),
    ...proof.map((sibling) => Buffer.from(sibling)),
  ])
}

export interface RegisterVerseParams {
  readonly adopter: PublicKey
  readonly address: VerseAddress
  readonly text: string
  readonly proof: readonly Uint8Array[]
  readonly programId?: PublicKey
}

/** The `register_verse` instruction, accounts in the order the IDL declares. */
export function registerVerseInstruction(params: RegisterVerseParams): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID
  const [config] = configPda(programId)
  const [bookRoots] = bookRootsPda(params.address.book, programId)
  const [verseAccount] = versePda(params.address, programId)

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: bookRoots, isSigner: false, isWritable: false },
      { pubkey: verseAccount, isSigner: false, isWritable: true },
      { pubkey: params.adopter, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeRegisterVerse(params.address, params.text, params.proof),
  })
}

export interface RegisterVerseTransactionParams extends RegisterVerseParams {
  readonly recentBlockhash: string
  /** ComputeBudget fits within the 201-byte margin measured in PG-00. */
  readonly computeUnitLimit?: number
  readonly priorityFeeMicroLamports?: number
}

/**
 * A v0 transaction for `register_verse`, with ComputeBudget instructions when
 * requested. v0 over legacy for the 2-byte cost and to keep Address Lookup
 * Tables available if a future instruction ever needs them.
 *
 * Returned unsigned: the wallet adapter signs it.
 */
export function registerVerseTransaction(
  params: RegisterVerseTransactionParams,
): VersionedTransaction {
  const instructions: TransactionInstruction[] = []
  if (params.computeUnitLimit !== undefined) {
    instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: params.computeUnitLimit }))
  }
  if (params.priorityFeeMicroLamports !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: params.priorityFeeMicroLamports }),
    )
  }
  instructions.push(registerVerseInstruction(params))

  const message = new TransactionMessage({
    payerKey: params.adopter,
    recentBlockhash: params.recentBlockhash,
    instructions,
  }).compileToV0Message()

  return new VersionedTransaction(message)
}
