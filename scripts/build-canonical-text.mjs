#!/usr/bin/env node
// Gera data/canonical-text/ (1 JSON por livro) a partir do arquivo VPL
// (verse-per-line) da World English Bible distribuído pelo eBible.org.
//
// Uso: node scripts/build-canonical-text.mjs <caminho/engwebp_vpl.txt>
//
// O dataset gerado é a source of truth do CanonicalText — ver
// docs/decisions/2026-07-18_texto-canonico-no-repo-e-no-banco.md
//
// A WEB preserva a numeração tradicional mas omite do texto principal os
// versículos ausentes do Texto Majoritário (ex.: Atos 8:37). Essas posições
// viram `null` no JSON: existem na versificação, não têm texto e NÃO são
// registráveis on-chain.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = 'data/canonical-text'

// Ordem canônica protestante (66 livros); códigos do VPL do eBible.org
const BOOKS = [
  ['GEN', 'Genesis', 'Gen', 'genesis', 'OLD'],
  ['EXO', 'Exodus', 'Exod', 'exodus', 'OLD'],
  ['LEV', 'Leviticus', 'Lev', 'leviticus', 'OLD'],
  ['NUM', 'Numbers', 'Num', 'numbers', 'OLD'],
  ['DEU', 'Deuteronomy', 'Deut', 'deuteronomy', 'OLD'],
  ['JOS', 'Joshua', 'Josh', 'joshua', 'OLD'],
  ['JDG', 'Judges', 'Judg', 'judges', 'OLD'],
  ['RUT', 'Ruth', 'Ruth', 'ruth', 'OLD'],
  ['1SA', '1 Samuel', '1Sam', '1samuel', 'OLD'],
  ['2SA', '2 Samuel', '2Sam', '2samuel', 'OLD'],
  ['1KI', '1 Kings', '1Kgs', '1kings', 'OLD'],
  ['2KI', '2 Kings', '2Kgs', '2kings', 'OLD'],
  ['1CH', '1 Chronicles', '1Chr', '1chronicles', 'OLD'],
  ['2CH', '2 Chronicles', '2Chr', '2chronicles', 'OLD'],
  ['EZR', 'Ezra', 'Ezra', 'ezra', 'OLD'],
  ['NEH', 'Nehemiah', 'Neh', 'nehemiah', 'OLD'],
  ['EST', 'Esther', 'Esth', 'esther', 'OLD'],
  ['JOB', 'Job', 'Job', 'job', 'OLD'],
  ['PSA', 'Psalms', 'Ps', 'psalms', 'OLD'],
  ['PRO', 'Proverbs', 'Prov', 'proverbs', 'OLD'],
  ['ECC', 'Ecclesiastes', 'Eccl', 'ecclesiastes', 'OLD'],
  ['SOL', 'Song of Solomon', 'Song', 'song-of-solomon', 'OLD'],
  ['ISA', 'Isaiah', 'Isa', 'isaiah', 'OLD'],
  ['JER', 'Jeremiah', 'Jer', 'jeremiah', 'OLD'],
  ['LAM', 'Lamentations', 'Lam', 'lamentations', 'OLD'],
  ['EZE', 'Ezekiel', 'Ezek', 'ezekiel', 'OLD'],
  ['DAN', 'Daniel', 'Dan', 'daniel', 'OLD'],
  ['HOS', 'Hosea', 'Hos', 'hosea', 'OLD'],
  ['JOE', 'Joel', 'Joel', 'joel', 'OLD'],
  ['AMO', 'Amos', 'Amos', 'amos', 'OLD'],
  ['OBA', 'Obadiah', 'Obad', 'obadiah', 'OLD'],
  ['JON', 'Jonah', 'Jonah', 'jonah', 'OLD'],
  ['MIC', 'Micah', 'Mic', 'micah', 'OLD'],
  ['NAH', 'Nahum', 'Nah', 'nahum', 'OLD'],
  ['HAB', 'Habakkuk', 'Hab', 'habakkuk', 'OLD'],
  ['ZEP', 'Zephaniah', 'Zeph', 'zephaniah', 'OLD'],
  ['HAG', 'Haggai', 'Hag', 'haggai', 'OLD'],
  ['ZEC', 'Zechariah', 'Zech', 'zechariah', 'OLD'],
  ['MAL', 'Malachi', 'Mal', 'malachi', 'OLD'],
  ['MAT', 'Matthew', 'Matt', 'matthew', 'NEW'],
  ['MAR', 'Mark', 'Mark', 'mark', 'NEW'],
  ['LUK', 'Luke', 'Luke', 'luke', 'NEW'],
  ['JOH', 'John', 'John', 'john', 'NEW'],
  ['ACT', 'Acts', 'Acts', 'acts', 'NEW'],
  ['ROM', 'Romans', 'Rom', 'romans', 'NEW'],
  ['1CO', '1 Corinthians', '1Cor', '1corinthians', 'NEW'],
  ['2CO', '2 Corinthians', '2Cor', '2corinthians', 'NEW'],
  ['GAL', 'Galatians', 'Gal', 'galatians', 'NEW'],
  ['EPH', 'Ephesians', 'Eph', 'ephesians', 'NEW'],
  ['PHI', 'Philippians', 'Phil', 'philippians', 'NEW'],
  ['COL', 'Colossians', 'Col', 'colossians', 'NEW'],
  ['1TH', '1 Thessalonians', '1Thess', '1thessalonians', 'NEW'],
  ['2TH', '2 Thessalonians', '2Thess', '2thessalonians', 'NEW'],
  ['1TI', '1 Timothy', '1Tim', '1timothy', 'NEW'],
  ['2TI', '2 Timothy', '2Tim', '2timothy', 'NEW'],
  ['TIT', 'Titus', 'Titus', 'titus', 'NEW'],
  ['PHM', 'Philemon', 'Phlm', 'philemon', 'NEW'],
  ['HEB', 'Hebrews', 'Heb', 'hebrews', 'NEW'],
  ['JAM', 'James', 'Jas', 'james', 'NEW'],
  ['1PE', '1 Peter', '1Pet', '1peter', 'NEW'],
  ['2PE', '2 Peter', '2Pet', '2peter', 'NEW'],
  ['1JO', '1 John', '1John', '1john', 'NEW'],
  ['2JO', '2 John', '2John', '2john', 'NEW'],
  ['3JO', '3 John', '3John', '3john', 'NEW'],
  ['JUD', 'Jude', 'Jude', 'jude', 'NEW'],
  ['REV', 'Revelation', 'Rev', 'revelation', 'NEW'],
]

// A edição engwebp já é o canon protestante de 66 livros; o filtro fica
// como defesa caso a fonte mude para uma edição com apócrifos
const SKIP_CODES = new Set([
  'TOB', 'JDT', 'ESG', 'WIS', 'SIR', 'BAR', 'PRA', 'SUS', 'BEL',
  '1MA', '2MA', '1ES', '2ES', 'PRM', '3ES', '4ES', 'MAN', 'LJE', 'S3Y',
])

const LINE_PATTERN = /^(\S+) (\d+):(\d+) ?(.*)$/

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

// Normaliza espaços e remove pilcrows caso a fonte os traga (a WEB não usa)
function cleanText(text) {
  return text.replace(/¶/g, ' ').replace(/\s+/g, ' ').trim()
}

const vplPath = process.argv[2]
if (!vplPath) fail('usage: node scripts/build-canonical-text.mjs <engwebp_vpl.txt>')

const codeToBook = new Map(
  BOOKS.map(([code, name, abbreviation, slug, testament], i) => [
    code,
    { book: i + 1, name, abbreviation, slug, testament, chapters: [] },
  ]),
)

const lines = readFileSync(vplPath, 'utf8').split('\n').filter(Boolean)
const omitted = []

for (const line of lines) {
  const match = line.match(LINE_PATTERN)
  if (!match) fail(`malformed line: ${line.slice(0, 60)}`)

  const [, code, chapterStr, verseStr, text] = match
  if (SKIP_CODES.has(code)) continue

  const entry = codeToBook.get(code)
  if (!entry) fail(`unknown book code: ${code}`)

  const chapter = Number(chapterStr)
  const verse = Number(verseStr)

  // Capítulos e versículos devem chegar contíguos e em ordem — qualquer
  // salto indica problema de versificação e invalida a Merkle tree
  if (chapter === entry.chapters.length + 1 && verse === 1) {
    entry.chapters.push([])
  } else if (chapter !== entry.chapters.length || verse !== entry.chapters[chapter - 1].length + 1) {
    fail(`non-contiguous reference: ${code} ${chapter}:${verse}`)
  }

  const cleaned = cleanText(text)
  if (cleaned === '') {
    entry.chapters[chapter - 1].push(null)
    omitted.push(`${code} ${chapter}:${verse}`)
  } else {
    entry.chapters[chapter - 1].push(cleaned)
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true })

let totalChapters = 0
let totalVerses = 0

for (const entry of codeToBook.values()) {
  if (entry.chapters.length === 0) fail(`missing book: ${entry.name}`)

  const { slug, ...bookData } = entry
  const fileName = `${String(entry.book).padStart(2, '0')}-${slug}.json`
  writeFileSync(join(OUTPUT_DIR, fileName), JSON.stringify(bookData, null, 1) + '\n')

  totalChapters += entry.chapters.length
  totalVerses += entry.chapters.reduce(
    (sum, verses) => sum + verses.filter((v) => v !== null).length,
    0,
  )
}

console.log(`books: ${codeToBook.size}`)
console.log(`chapters: ${totalChapters}`)
console.log(`verses (registrable): ${totalVerses}`)
console.log(`omitted placeholders (${omitted.length}): ${omitted.join(', ')}`)
