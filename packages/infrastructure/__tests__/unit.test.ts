import { eventDiscriminator } from '@eternal-word/blockchain'
import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { parseHeliusWebhook } from '../src/chain/helius-webhook.js'

const adopter = Keypair.generate().publicKey

function programDataLine(book: number, chapter: number, verse: number, createdAt: bigint): string {
  const body = Buffer.alloc(1 + 2 + 2 + 32 + 8)
  let offset = 0
  body.writeUInt8(book, offset)
  offset += 1
  body.writeUInt16LE(chapter, offset)
  offset += 2
  body.writeUInt16LE(verse, offset)
  offset += 2
  adopter.toBuffer().copy(body, offset)
  offset += 32
  body.writeBigInt64LE(createdAt, offset)
  const data = Buffer.concat([eventDiscriminator('VerseRegistered'), body])
  return `Program data: ${data.toString('base64')}`
}

describe('parseHeliusWebhook', () => {
  it('extracts VerseRegistered events from a raw webhook payload', () => {
    const payload = [
      {
        slot: 123,
        transaction: { signatures: ['SigAbc'] },
        meta: {
          err: null,
          logMessages: ['Program log: noise', programDataLine(1, 1, 5, 1_700_000_000n)],
        },
      },
    ]
    const events = parseHeliusWebhook(payload)
    expect(events).toHaveLength(1)
    expect(events[0]?.address).toEqual({ book: 1, chapter: 1, verse: 5 })
    expect(events[0]?.transaction).toBe('SigAbc')
    expect(events[0]?.slot).toBe(123n)
    expect(events[0]?.adopter).toBe(adopter.toBase58())
  })

  it('skips failed transactions and non-array payloads', () => {
    expect(parseHeliusWebhook({})).toEqual([])
    const failed = [
      {
        slot: 1,
        transaction: { signatures: ['S'] },
        meta: {
          err: { InstructionError: [0, 'Custom'] },
          logMessages: [programDataLine(1, 1, 6, 1n)],
        },
      },
    ]
    expect(parseHeliusWebhook(failed)).toEqual([])
  })
})
