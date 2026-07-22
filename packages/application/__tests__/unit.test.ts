import {
  VERSE_STATUS,
  type VerseAddress,
  type VerseStatus,
  verseAddressKey,
} from '@eternal-word/domain'
import { describe, expect, it } from 'vitest'
import {
  type ChainReader,
  type MirrorEntry,
  type VerseRegistered,
  type VerseRepository,
  markPending,
  reconcile,
  recordRegistered,
} from '../src/index.js'

const address = (book: number, chapter: number, verse: number): VerseAddress => ({
  book,
  chapter,
  verse,
})

const event = (a: VerseAddress, slot = 1n): VerseRegistered => ({
  address: a,
  adopter: 'Wallet1111',
  account: 'Account1111',
  transaction: 'Sig1111',
  slot,
  registeredAt: new Date('2026-07-22T00:00:00Z'),
})

/** In-memory mirror: only non-AVAILABLE rows are stored; a missing key reads as
 * AVAILABLE, which is exactly how `releaseToAvailable` behaves. */
class InMemoryRepo implements VerseRepository {
  readonly rows = new Map<string, { address: VerseAddress; status: VerseStatus }>()

  set(a: VerseAddress, status: VerseStatus): void {
    this.rows.set(verseAddressKey(a), { address: a, status })
  }

  async recordRegistered(e: VerseRegistered): Promise<void> {
    this.set(e.address, VERSE_STATUS.REGISTERED)
  }
  async markPending(a: VerseAddress): Promise<void> {
    this.set(a, VERSE_STATUS.PENDING)
  }
  async failStalePending(): Promise<VerseAddress[]> {
    return []
  }
  async listNonAvailable(): Promise<MirrorEntry[]> {
    return [...this.rows.values()].map((row) => ({ address: row.address, status: row.status }))
  }
  async releaseToAvailable(a: VerseAddress): Promise<void> {
    this.rows.delete(verseAddressKey(a))
  }
}

const chainOf = (events: VerseRegistered[]): ChainReader => ({
  listRegistrations: async () => events,
})

describe('reconcile', () => {
  it('records on-chain registrations the mirror is missing', async () => {
    const repo = new InMemoryRepo()
    const report = await reconcile(repo, chainOf([event(address(1, 1, 1))]))
    expect(report).toEqual({ recorded: 1, released: 0 })
    expect(repo.rows.get('1:1:1')?.status).toBe(VERSE_STATUS.REGISTERED)
  })

  it('releases a REGISTERED row the chain no longer backs (reorg)', async () => {
    const repo = new InMemoryRepo()
    repo.set(address(1, 1, 1), VERSE_STATUS.REGISTERED)
    const report = await reconcile(repo, chainOf([]))
    expect(report.released).toBe(1)
    expect(repo.rows.has('1:1:1')).toBe(false)
  })

  it('releases a FAILED attempt not on-chain', async () => {
    const repo = new InMemoryRepo()
    repo.set(address(1, 1, 2), VERSE_STATUS.FAILED)
    expect((await reconcile(repo, chainOf([]))).released).toBe(1)
  })

  it('leaves a PENDING not yet on-chain for expiry to age out', async () => {
    const repo = new InMemoryRepo()
    repo.set(address(1, 1, 3), VERSE_STATUS.PENDING)
    const report = await reconcile(repo, chainOf([]))
    expect(report.released).toBe(0)
    expect(repo.rows.get('1:1:3')?.status).toBe(VERSE_STATUS.PENDING)
  })
})

describe('address validation', () => {
  it('rejects a registration with an out-of-range book', async () => {
    await expect(recordRegistered(new InMemoryRepo(), event(address(99, 1, 1)))).rejects.toThrow()
  })

  it('rejects marking an out-of-range address pending', async () => {
    await expect(markPending(new InMemoryRepo(), address(0, 1, 1), 'Sig')).rejects.toThrow()
  })
})
