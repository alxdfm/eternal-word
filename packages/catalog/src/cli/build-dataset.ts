/**
 * Rebuilds data/canonical-text/ from the verse-per-line distribution of the
 * World English Bible (eBible.org, id `engwebp`).
 *
 *   pnpm catalog:build <path/to/engwebp_vpl.txt>
 *
 * The committed dataset is a frozen snapshot — see
 * data/canonical-text/PROVENANCE.md. Running this against a newer upstream
 * file would change the Merkle root, which is exactly what must not happen
 * once the root is on-chain. `pnpm catalog:merkle --check` in CI is the
 * guard against that.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { APOCRYPHA_SOURCE_CODES, BOOKS, BOOKS_BY_SOURCE_CODE } from '../books.js'
import { canonicalTextDir } from '../dataset.js'

const LINE_PATTERN = /^(\S+) (\d+):(\d+) ?(.*)$/

function fail(message: string): never {
  process.stderr.write(`ERROR: ${message}\n`)
  process.exit(1)
}

/** Normalises whitespace and strips pilcrows should the source carry them
 * (the WEB does not; the KJV distribution does). */
function cleanText(text: string): string {
  return text.replace(/¶/g, ' ').replace(/\s+/g, ' ').trim()
}

const sourcePath = process.argv[2]
if (sourcePath === undefined) {
  fail('usage: pnpm catalog:build <engwebp_vpl.txt>')
}

const chaptersByBook = new Map<number, (string | null)[][]>(BOOKS.map((book) => [book.book, []]))
const omitted: string[] = []

const lines = readFileSync(sourcePath, 'utf8').split('\n').filter(Boolean)

for (const line of lines) {
  const match = line.match(LINE_PATTERN)
  if (match === null) fail(`malformed line: ${line.slice(0, 60)}`)

  const [, sourceCode = '', chapterText = '', verseText = '', text = ''] = match
  if (APOCRYPHA_SOURCE_CODES.has(sourceCode)) continue

  const book = BOOKS_BY_SOURCE_CODE.get(sourceCode)
  if (book === undefined) fail(`unknown book code: ${sourceCode}`)

  const chapters = chaptersByBook.get(book.book)
  if (chapters === undefined) fail(`missing chapter bucket for ${sourceCode}`)

  const chapter = Number(chapterText)
  const verse = Number(verseText)

  // Chapters and verses must arrive contiguous and in order. A gap means the
  // versification is not what we think it is, which would silently change the
  // Merkle tree.
  if (chapter === chapters.length + 1 && verse === 1) {
    chapters.push([])
  } else if (chapter !== chapters.length || verse !== (chapters[chapter - 1]?.length ?? -1) + 1) {
    fail(`non-contiguous reference: ${sourceCode} ${chapter}:${verse}`)
  }

  const currentChapter = chapters[chapter - 1]
  // Unreachable after the check above, but a dropped verse would change the
  // Merkle root with no error at all — so it fails loudly instead.
  if (currentChapter === undefined) {
    fail(`chapter bucket missing after validation: ${sourceCode} ${chapter}:${verse}`)
  }

  const cleaned = cleanText(text)
  if (cleaned === '') omitted.push(`${sourceCode} ${chapter}:${verse}`)
  currentChapter.push(cleaned === '' ? null : cleaned)
}

mkdirSync(canonicalTextDir(), { recursive: true })

let totalChapters = 0
let totalVerses = 0

for (const book of BOOKS) {
  const chapters = chaptersByBook.get(book.book) ?? []
  if (chapters.length === 0) fail(`missing book: ${book.name}`)

  const payload = {
    book: book.book,
    name: book.name,
    abbreviation: book.abbreviation,
    testament: book.testament,
    chapters,
  }

  const fileName = `${String(book.book).padStart(2, '0')}-${book.slug}.json`
  writeFileSync(join(canonicalTextDir(), fileName), `${JSON.stringify(payload, null, 1)}\n`)

  totalChapters += chapters.length
  totalVerses += chapters.reduce(
    (sum, verses) => sum + verses.filter((verse) => verse !== null).length,
    0,
  )
}

process.stdout.write(
  [
    `books:                ${BOOKS.length}`,
    `chapters:             ${totalChapters}`,
    `registrable verses:   ${totalVerses}`,
    `omitted positions:    ${omitted.length} — ${omitted.join(', ')}`,
    '',
  ].join('\n'),
)
