'use client'

import type { OmittedPosition } from '@/lib/books'
import { useTranslations } from 'next-intl'

export interface BookLabels {
  /** Full name, e.g. "John". */
  name: (book: number) => string
  /** Abbreviation, e.g. "John", "1Cor". */
  abbr: (book: number) => string
  /** "John 3:16" (or "John 3" when verse is omitted). */
  reference: (book: number, chapter: number, verse?: number) => string
  /** "John 3:16" using the abbreviation — for dense rows. */
  abbrReference: (book: number, chapter: number, verse?: number) => string
}

/**
 * Number (1-66) → English-first labels, via next-intl. The canonical source is
 * the catalog; these messages are a translatable projection of it (guarded by a
 * test). This is what kills "book 43" from the UI.
 */
export function useBookLabels(): BookLabels {
  const t = useTranslations('books')
  const name = (book: number) => t(`${book}.name`)
  const abbr = (book: number) => t(`${book}.abbr`)
  const ref = (label: string, chapter: number, verse?: number) =>
    verse === undefined ? `${label} ${chapter}` : `${label} ${chapter}:${verse}`
  return {
    name,
    abbr,
    reference: (book, chapter, verse) => ref(name(book), chapter, verse),
    abbrReference: (book, chapter, verse) => ref(abbr(book), chapter, verse),
  }
}

export interface OmittedNote {
  readonly label: string
  readonly note: string
  /** Present only for a relocated position — the reference its text moved to. */
  readonly pointer?: { readonly reference: string; readonly action: string }
}

/**
 * Localized explanation for one of the five omitted positions — a note, never an
 * error. A relocated position (Romans 16:25) also carries a pointer to where the
 * text actually is (Romans 14:24-26).
 */
export function useOmittedNote(): (position: OmittedPosition) => OmittedNote {
  const t = useTranslations('omitted')
  const labels = useBookLabels()

  return (position) => {
    if (position.kind === 'relocated' && position.pointer !== undefined) {
      const p = position.pointer
      const reference = `${labels.name(p.book)} ${p.chapter}:${p.verseStart}–${p.verseEnd}`
      return {
        label: t('relocatedLabel'),
        note: t('relocatedNote', { pointer: reference }),
        pointer: { reference, action: t('pointerAction', { pointer: reference }) },
      }
    }
    return {
      label: t('absentLabel'),
      note: t('absentNote', {
        prev: `${position.chapter}:${position.prevVerse}`,
        next: `${position.chapter}:${position.nextVerse}`,
      }),
    }
  }
}
