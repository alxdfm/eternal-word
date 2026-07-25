/** One registrable verse's text within a chapter. */
export interface ChapterVerseText {
  readonly verse: number
  readonly text: string
}

/**
 * A chapter's registrable verses, for reconstructing the chapter Merkle tree
 * server-side (the proof endpoint). Minimal on purpose — just verse number and
 * text, in canonical (ascending) order. Implemented over Postgres in
 * infrastructure; the sync write side never touches it.
 */
export interface ChapterTextReader {
  listChapter(book: number, chapter: number): Promise<readonly ChapterVerseText[]>
}
