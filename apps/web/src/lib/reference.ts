/**
 * Parses a pasted verse reference like `Isa 60:19`, `1 Cor 13:4`,
 * `Song of Solomon 3:16` or `João 3:16` into `(book, chapter, verse)` (UX-07).
 *
 * The book is matched against candidate strings supplied by the caller — the
 * localized name and abbreviation of each book (from the i18n labels), so the
 * parser stays free of the catalog and works in whatever locale the UI is in.
 */
export interface ParsedReference {
  readonly book: number
  readonly chapter: number
  readonly verse: number
}

// Nonspacing combining marks — what NFD leaves after decomposing accents
// (é → e + ´). `\p{Mn}` avoids a literal combining-character class.
const DIACRITICS = /\p{Mn}/gu

/** Fold for comparison: lowercase, drop diacritics (João → joao), dots and all
 * whitespace — so `1 Cor` matches the abbreviation `1Cor`, and `Song of Solomon`
 * matches `Song of Solomon`. */
function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS, '').replace(/[.\s]/g, '')
}

export function parseReference(
  input: string,
  bookCandidates: (book: number) => readonly string[],
): ParsedReference | null {
  // Book part is everything before a trailing `chapter:verse` (`:` or `.`).
  const match = input.trim().match(/^(.+?)\s*(\d+)\s*[:.]\s*(\d+)\s*$/)
  if (match === null) {
    return null
  }
  const bookPart = fold(match[1] as string)
  const chapter = Number(match[2])
  const verse = Number(match[3])
  if (bookPart === '' || chapter < 1 || verse < 1) {
    return null
  }
  for (let book = 1; book <= 66; book++) {
    for (const candidate of bookCandidates(book)) {
      if (fold(candidate) === bookPart) {
        return { book, chapter, verse }
      }
    }
  }
  return null
}
