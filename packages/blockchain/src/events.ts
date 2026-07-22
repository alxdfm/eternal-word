import { PublicKey } from '@solana/web3.js'
import { eventDiscriminator } from './program.js'

const DISCRIMINATOR = eventDiscriminator('VerseRegistered')
const PROGRAM_DATA_PREFIX = 'Program data: '

/**
 * The on-chain VerseRegistered event, decoded from a `Program data:` log line.
 * Field order mirrors the `#[event]` struct in register_verse.rs:
 *   book u8 | chapter u16le | verse u16le | adopter Pubkey[32] | created_at i64
 * The indexer enriches this with the transaction signature and slot.
 */
export interface VerseRegisteredEvent {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly adopter: PublicKey
  readonly createdAt: bigint
}

export function decodeVerseRegisteredEvent(data: Buffer): VerseRegisteredEvent {
  if (data.length < 8 || !data.subarray(0, 8).equals(DISCRIMINATOR)) {
    throw new Error('data is not a VerseRegistered event')
  }
  let offset = 8
  const book = data.readUInt8(offset)
  offset += 1
  const chapter = data.readUInt16LE(offset)
  offset += 2
  const verse = data.readUInt16LE(offset)
  offset += 2
  const adopter = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32
  const createdAt = data.readBigInt64LE(offset)
  return { book, chapter, verse, adopter, createdAt }
}

/** Every VerseRegistered event carried on a transaction's `Program data:` log
 * lines. Anchor's `emit!` logs the event there, base64-encoded. */
export function verseRegisteredEventsFromLogs(logs: readonly string[]): VerseRegisteredEvent[] {
  const events: VerseRegisteredEvent[] = []
  for (const line of logs) {
    if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue
    const data = Buffer.from(line.slice(PROGRAM_DATA_PREFIX.length), 'base64')
    if (data.length >= 8 && data.subarray(0, 8).equals(DISCRIMINATOR)) {
      events.push(decodeVerseRegisteredEvent(data))
    }
  }
  return events
}
