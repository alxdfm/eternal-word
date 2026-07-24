import type { VerseReadRepository, VerseView } from '@eternal-word/application'
import { describe, expect, it } from 'vitest'
import { handleReadVerse } from '../src/web/read-verse.js'
import type { VerseDto } from '../src/web/verse-dto.js'

function repoReturning(view: VerseView | null): VerseReadRepository {
  return { findByAddress: async () => view }
}

const registered: VerseView = {
  address: { book: 1, chapter: 1, verse: 1 },
  text: 'In the beginning God created the heavens and the earth.',
  registrable: true,
  status: 'REGISTERED',
  adopter: 'Adopter1111111111111111111111111111111111111',
  transaction: 'Sig111',
  account: 'Acc111',
  slot: 478083892n,
  registeredAt: new Date('2026-07-22T00:00:00.000Z'),
}

describe('handleReadVerse', () => {
  it('returns 200 with the DTO for a registered verse', async () => {
    const res = await handleReadVerse(repoReturning(registered), {
      book: '1',
      chapter: '1',
      verse: '1',
    })
    expect(res.statusCode).toBe(200)
    const dto = JSON.parse(res.body) as VerseDto
    expect(dto.status).toBe('REGISTERED')
    expect(dto.registrable).toBe(true)
    // bigint slot crosses the JSON boundary as a string; timestamp as ISO.
    expect(dto.slot).toBe('478083892')
    expect(dto.registeredAt).toBe('2026-07-22T00:00:00.000Z')
    expect(dto.text).toContain('In the beginning')
  })

  it('marks an omitted position as not registrable', async () => {
    const omitted: VerseView = {
      address: { book: 42, chapter: 17, verse: 36 }, // Luke 17:36 — omitted in the WEB
      text: null,
      registrable: false,
      status: null,
      adopter: null,
      transaction: null,
      account: null,
      slot: null,
      registeredAt: null,
    }
    const res = await handleReadVerse(repoReturning(omitted), {
      book: '42',
      chapter: '17',
      verse: '36',
    })
    expect(res.statusCode).toBe(200)
    const dto = JSON.parse(res.body) as VerseDto
    expect(dto.registrable).toBe(false)
    expect(dto.text).toBeNull()
    expect(dto.status).toBeNull()
  })

  it('returns 404 when the reference is not in the versification', async () => {
    const res = await handleReadVerse(repoReturning(null), {
      book: '1',
      chapter: '150',
      verse: '1',
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects an out-of-range reference with 400', async () => {
    const res = await handleReadVerse(repoReturning(registered), {
      book: '0',
      chapter: '1',
      verse: '1',
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects non-integer params with 400', async () => {
    const res = await handleReadVerse(repoReturning(registered), {
      book: 'x',
      chapter: '1',
      verse: '1',
    })
    expect(res.statusCode).toBe(400)
  })
})
