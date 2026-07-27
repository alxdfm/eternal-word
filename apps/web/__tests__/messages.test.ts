import { describe, expect, it } from 'vitest'
import en from '../messages/en.json'
import ptBR from '../messages/pt-BR.json'

// A locale só é "completa" se cobre EXATAMENTE as mesmas chaves da default (en) —
// uma chave faltando em pt-BR vira fallback (string em inglês ou erro), que é o
// que o critério da S06 proíbe ("zero string sem tradução"). Este guard falha o
// build se as duas locales divergirem em chave ou em placeholder ICU.

type Json = Record<string, unknown>

function flatten(obj: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of flatten(value as Json, path)) out.set(k, v)
    } else {
      out.set(path, String(value))
    }
  }
  return out
}

// Nomes de variável ICU de uma string: `{count, number}` → "count", `{query}` →
// "query". A formatação (number/plural) pode diferir por locale; as variáveis não.
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)/g)].map((m) => m[1] as string).sort()
}

const flatEn = flatten(en as Json)
const flatPt = flatten(ptBR as Json)

describe('pt-BR mirrors en (locale completeness)', () => {
  it('has exactly the same keys as en', () => {
    expect([...flatPt.keys()].sort()).toEqual([...flatEn.keys()].sort())
  })

  it('carries the same ICU placeholders per key', () => {
    for (const [key, enValue] of flatEn) {
      const ptValue = flatPt.get(key)
      expect(ptValue, `missing pt-BR for ${key}`).toBeDefined()
      expect(placeholders(ptValue as string), `placeholder drift in ${key}`).toEqual(
        placeholders(enValue),
      )
    }
  })

  it('leaves no value empty or identical fallback for prose', () => {
    for (const [key, ptValue] of flatPt) {
      expect(ptValue.trim(), `empty pt-BR value at ${key}`).not.toBe('')
    }
  })
})

describe('pt-BR book names', () => {
  const books = (ptBR as { books: Record<string, { name: string; abbr: string }> }).books

  it('translates all 66 books with a name and abbreviation', () => {
    expect(Object.keys(books)).toHaveLength(66)
    for (let n = 1; n <= 66; n++) {
      const entry = books[String(n)]
      expect(entry, `missing book ${n}`).toBeDefined()
      expect(entry?.name.trim(), `empty name for book ${n}`).not.toBe('')
      expect(entry?.abbr.trim(), `empty abbr for book ${n}`).not.toBe('')
    }
  })

  it('actually translates (Genesis → Gênesis, Revelation → Apocalipse)', () => {
    expect(books['1']?.name).toBe('Gênesis')
    expect(books['66']?.name).toBe('Apocalipse')
  })
})
