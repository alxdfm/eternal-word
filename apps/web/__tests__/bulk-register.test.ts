import type { VersionedTransaction } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import type { VerseReference } from '../src/lib/api'
import { type BulkRegisterIO, bulkRegisterVerses } from '../src/lib/bulk-register'

// A verse reference in book 1, chapter 1.
const ref = (verse: number): VerseReference => ({ book: 1, chapter: 1, verse })
const refs = (n: number): VerseReference[] => Array.from({ length: n }, (_, i) => ref(i + 1))

// A stub transaction — the orchestration only passes it through signAll/send.
const stubTx = (): VersionedTransaction => ({}) as unknown as VersionedTransaction

interface Recorder {
  signAllCalls: number
  builds: number[]
  sends: number
}

function makeIO(overrides: Partial<BulkRegisterIO> = {}): { io: BulkRegisterIO; rec: Recorder } {
  const rec: Recorder = { signAllCalls: 0, builds: [], sends: 0 }
  const io: BulkRegisterIO = {
    getBlockhash: async () => 'blockhash',
    buildTransaction: async (r) => {
      rec.builds.push(r.verse)
      return stubTx()
    },
    signAll: async (txs) => {
      rec.signAllCalls++
      return txs
    },
    send: async () => {
      rec.sends++
      return 'signature'
    },
    ...overrides,
  }
  return { io, rec }
}

describe('bulkRegisterVerses', () => {
  it('registers every verse and signs one batch per batchSize (one approval each)', async () => {
    const { io, rec } = makeIO()
    const outcome = await bulkRegisterVerses(refs(5), io, { batchSize: 2 })

    expect(outcome.succeeded).toHaveLength(5)
    expect(outcome.failed).toHaveLength(0)
    expect(outcome.aborted).toBe(false)
    // 5 verses in batches of 2 → 3 batches → 3 wallet approvals.
    expect(rec.signAllCalls).toBe(3)
  })

  it('reports progress once per verse', async () => {
    const { io } = makeIO()
    let progress = 0
    await bulkRegisterVerses(refs(4), io, { onProgress: () => progress++ })
    expect(progress).toBe(4)
  })

  it('retries a transient send failure, then succeeds', async () => {
    let attempts = 0
    const { io, rec } = makeIO({
      send: async () => {
        attempts++
        if (attempts === 1) {
          throw new Error('temporary rpc glitch')
        }
        return 'signature'
      },
    })
    const outcome = await bulkRegisterVerses([ref(1)], io, { sendAttempts: 3 })

    expect(outcome.succeeded).toHaveLength(1)
    expect(rec.sends).toBe(0) // send overridden — count via attempts
    expect(attempts).toBe(2)
  })

  it('does not retry a duplicate (already registered) — it is terminal', async () => {
    let attempts = 0
    const { io } = makeIO({
      send: async () => {
        attempts++
        throw new Error('Allocate: account already in use')
      },
    })
    const outcome = await bulkRegisterVerses([ref(1)], io, { sendAttempts: 3 })

    expect(outcome.succeeded).toHaveLength(0)
    expect(outcome.failed).toHaveLength(1)
    expect(attempts).toBe(1)
  })

  it('fails only the verse whose transaction could not be built', async () => {
    const { io } = makeIO({
      buildTransaction: async (r) => {
        if (r.verse === 2) {
          throw new Error('proof fetch failed')
        }
        return stubTx()
      },
    })
    const outcome = await bulkRegisterVerses(refs(3), io, { batchSize: 5 })

    expect(outcome.succeeded.map((r) => r.verse).sort()).toEqual([1, 3])
    expect(outcome.failed.map((f) => f.reference.verse)).toEqual([2])
  })

  it('fails only the batch whose blockhash could not be fetched, and goes on', async () => {
    let calls = 0
    const { io, rec } = makeIO({
      getBlockhash: async () => {
        calls++
        // First batch: the RPC throttles the burst; second batch recovers.
        if (calls === 1) {
          throw new Error('failed to get recent blockhash')
        }
        return 'blockhash'
      },
    })
    const outcome = await bulkRegisterVerses(refs(4), io, { batchSize: 2 })

    // Not aborted: the first batch (2 verses) failed, the second (2) succeeded.
    expect(outcome.aborted).toBe(false)
    expect(outcome.failed.map((f) => f.reference.verse).sort()).toEqual([1, 2])
    expect(outcome.succeeded.map((r) => r.verse).sort()).toEqual([3, 4])
    // The first batch never built or sent; the second did.
    expect(rec.builds).toEqual([3, 4])
    expect(rec.sends).toBe(2)
  })

  it('aborts the whole run when a batch signature is declined', async () => {
    const { io, rec } = makeIO({
      signAll: async () => {
        throw new Error('User rejected the request')
      },
    })
    const outcome = await bulkRegisterVerses(refs(3), io, { batchSize: 2 })

    expect(outcome.aborted).toBe(true)
    // Only the first batch (2 verses) was attempted; the rest never built.
    expect(outcome.failed).toHaveLength(2)
    expect(rec.builds).toEqual([1, 2])
    expect(rec.sends).toBe(0)
  })
})
