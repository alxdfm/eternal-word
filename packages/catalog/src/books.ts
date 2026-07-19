import { TESTAMENT, type Testament } from '@eternal-word/domain'

export interface BookMetadata {
  /** Canonical index 1-66 — the value used in PDA seeds. */
  readonly book: number
  /** Book code used by the eBible.org verse-per-line distribution. */
  readonly sourceCode: string
  readonly name: string
  readonly abbreviation: string
  readonly slug: string
  readonly testament: Testament
}

const { OLD, NEW } = TESTAMENT

const TABLE: readonly (readonly [string, string, string, string, Testament])[] = [
  ['GEN', 'Genesis', 'Gen', 'genesis', OLD],
  ['EXO', 'Exodus', 'Exod', 'exodus', OLD],
  ['LEV', 'Leviticus', 'Lev', 'leviticus', OLD],
  ['NUM', 'Numbers', 'Num', 'numbers', OLD],
  ['DEU', 'Deuteronomy', 'Deut', 'deuteronomy', OLD],
  ['JOS', 'Joshua', 'Josh', 'joshua', OLD],
  ['JDG', 'Judges', 'Judg', 'judges', OLD],
  ['RUT', 'Ruth', 'Ruth', 'ruth', OLD],
  ['1SA', '1 Samuel', '1Sam', '1samuel', OLD],
  ['2SA', '2 Samuel', '2Sam', '2samuel', OLD],
  ['1KI', '1 Kings', '1Kgs', '1kings', OLD],
  ['2KI', '2 Kings', '2Kgs', '2kings', OLD],
  ['1CH', '1 Chronicles', '1Chr', '1chronicles', OLD],
  ['2CH', '2 Chronicles', '2Chr', '2chronicles', OLD],
  ['EZR', 'Ezra', 'Ezra', 'ezra', OLD],
  ['NEH', 'Nehemiah', 'Neh', 'nehemiah', OLD],
  ['EST', 'Esther', 'Esth', 'esther', OLD],
  ['JOB', 'Job', 'Job', 'job', OLD],
  ['PSA', 'Psalms', 'Ps', 'psalms', OLD],
  ['PRO', 'Proverbs', 'Prov', 'proverbs', OLD],
  ['ECC', 'Ecclesiastes', 'Eccl', 'ecclesiastes', OLD],
  ['SOL', 'Song of Solomon', 'Song', 'song-of-solomon', OLD],
  ['ISA', 'Isaiah', 'Isa', 'isaiah', OLD],
  ['JER', 'Jeremiah', 'Jer', 'jeremiah', OLD],
  ['LAM', 'Lamentations', 'Lam', 'lamentations', OLD],
  ['EZE', 'Ezekiel', 'Ezek', 'ezekiel', OLD],
  ['DAN', 'Daniel', 'Dan', 'daniel', OLD],
  ['HOS', 'Hosea', 'Hos', 'hosea', OLD],
  ['JOE', 'Joel', 'Joel', 'joel', OLD],
  ['AMO', 'Amos', 'Amos', 'amos', OLD],
  ['OBA', 'Obadiah', 'Obad', 'obadiah', OLD],
  ['JON', 'Jonah', 'Jonah', 'jonah', OLD],
  ['MIC', 'Micah', 'Mic', 'micah', OLD],
  ['NAH', 'Nahum', 'Nah', 'nahum', OLD],
  ['HAB', 'Habakkuk', 'Hab', 'habakkuk', OLD],
  ['ZEP', 'Zephaniah', 'Zeph', 'zephaniah', OLD],
  ['HAG', 'Haggai', 'Hag', 'haggai', OLD],
  ['ZEC', 'Zechariah', 'Zech', 'zechariah', OLD],
  ['MAL', 'Malachi', 'Mal', 'malachi', OLD],
  ['MAT', 'Matthew', 'Matt', 'matthew', NEW],
  ['MAR', 'Mark', 'Mark', 'mark', NEW],
  ['LUK', 'Luke', 'Luke', 'luke', NEW],
  ['JOH', 'John', 'John', 'john', NEW],
  ['ACT', 'Acts', 'Acts', 'acts', NEW],
  ['ROM', 'Romans', 'Rom', 'romans', NEW],
  ['1CO', '1 Corinthians', '1Cor', '1corinthians', NEW],
  ['2CO', '2 Corinthians', '2Cor', '2corinthians', NEW],
  ['GAL', 'Galatians', 'Gal', 'galatians', NEW],
  ['EPH', 'Ephesians', 'Eph', 'ephesians', NEW],
  ['PHI', 'Philippians', 'Phil', 'philippians', NEW],
  ['COL', 'Colossians', 'Col', 'colossians', NEW],
  ['1TH', '1 Thessalonians', '1Thess', '1thessalonians', NEW],
  ['2TH', '2 Thessalonians', '2Thess', '2thessalonians', NEW],
  ['1TI', '1 Timothy', '1Tim', '1timothy', NEW],
  ['2TI', '2 Timothy', '2Tim', '2timothy', NEW],
  ['TIT', 'Titus', 'Titus', 'titus', NEW],
  ['PHM', 'Philemon', 'Phlm', 'philemon', NEW],
  ['HEB', 'Hebrews', 'Heb', 'hebrews', NEW],
  ['JAM', 'James', 'Jas', 'james', NEW],
  ['1PE', '1 Peter', '1Pet', '1peter', NEW],
  ['2PE', '2 Peter', '2Pet', '2peter', NEW],
  ['1JO', '1 John', '1John', '1john', NEW],
  ['2JO', '2 John', '2John', '2john', NEW],
  ['3JO', '3 John', '3John', '3john', NEW],
  ['JUD', 'Jude', 'Jude', 'jude', NEW],
  ['REV', 'Revelation', 'Rev', 'revelation', NEW],
]

/** The 66 books of the protestant canon, in canonical order. The index is
 * what goes into PDA seeds — names vary between translations, indexes do not. */
export const BOOKS: readonly BookMetadata[] = TABLE.map(
  ([sourceCode, name, abbreviation, slug, testament], position) => ({
    book: position + 1,
    sourceCode,
    name,
    abbreviation,
    slug,
    testament,
  }),
)

export const BOOKS_BY_SOURCE_CODE: ReadonlyMap<string, BookMetadata> = new Map(
  BOOKS.map((book) => [book.sourceCode, book]),
)

/** Deuterocanonical codes that may appear in eBible distributions. The
 * `engwebp` edition carries none, but the filter guards against a source
 * swap silently widening the canon. */
export const APOCRYPHA_SOURCE_CODES: ReadonlySet<string> = new Set([
  'TOB',
  'JDT',
  'ESG',
  'WIS',
  'SIR',
  'BAR',
  'PRA',
  'SUS',
  'BEL',
  '1MA',
  '2MA',
  '1ES',
  '2ES',
  '3ES',
  '4ES',
  'PRM',
  'MAN',
  'LJE',
  'S3Y',
])
