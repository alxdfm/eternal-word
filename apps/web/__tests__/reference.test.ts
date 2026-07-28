import { describe, expect, it } from 'vitest'
import en from '../messages/en.json'
import ptBR from '../messages/pt-BR.json'
import { parseReference } from '../src/lib/reference'

type Books = Record<string, { name: string; abbr: string }>
const enCandidates = (b: number) => {
  const e = (en.books as Books)[String(b)]
  return e ? [e.name, e.abbr] : []
}
const ptCandidates = (b: number) => {
  const e = (ptBR.books as Books)[String(b)]
  return e ? [e.name, e.abbr] : []
}

describe('parseReference (UX-07)', () => {
  it('parses an abbreviation with a space and colon', () => {
    expect(parseReference('Isa 60:19', enCandidates)).toEqual({ book: 23, chapter: 60, verse: 19 })
  })

  it('parses the full book name', () => {
    expect(parseReference('Isaiah 60:19', enCandidates)).toEqual({ book: 23, chapter: 60, verse: 19 })
  })

  it('parses a numbered book with an internal space (1 Cor 13:4)', () => {
    expect(parseReference('1 Cor 13:4', enCandidates)).toEqual({ book: 46, chapter: 13, verse: 4 })
  })

  it('parses a multi-word name (Song of Solomon 3:16)', () => {
    expect(parseReference('Song of Solomon 3:16', enCandidates)).toEqual({
      book: 22,
      chapter: 3,
      verse: 16,
    })
  })

  it('parses pt-BR names with diacritics (João 3:16, Gênesis 1:1)', () => {
    expect(parseReference('João 3:16', ptCandidates)).toEqual({ book: 43, chapter: 3, verse: 16 })
    expect(parseReference('Gênesis 1:1', ptCandidates)).toEqual({ book: 1, chapter: 1, verse: 1 })
  })

  it('accepts a dot as the chapter:verse separator', () => {
    expect(parseReference('John 3.16', enCandidates)).toEqual({ book: 43, chapter: 3, verse: 16 })
  })

  it('returns null for a missing verse or unknown book', () => {
    expect(parseReference('Gen 1', enCandidates)).toBeNull()
    expect(parseReference('Nope 1:1', enCandidates)).toBeNull()
    expect(parseReference('', enCandidates)).toBeNull()
  })
})
