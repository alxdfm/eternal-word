import type { VerseView } from '@eternal-word/application'

/**
 * JSON-safe projection of {@link VerseView} for the HTTP boundary: the bigint
 * `slot` becomes a string and `registeredAt` an ISO timestamp. The web consumes
 * this shape (WB-06 polls it for the PENDING → REGISTERED transition).
 */
export interface VerseDto {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string | null
  readonly registrable: boolean
  readonly status: string | null
  readonly adopter: string | null
  readonly transaction: string | null
  readonly account: string | null
  readonly slot: string | null
  readonly registeredAt: string | null
}

export function toVerseDto(view: VerseView): VerseDto {
  return {
    book: view.address.book,
    chapter: view.address.chapter,
    verse: view.address.verse,
    text: view.text,
    registrable: view.registrable,
    status: view.status,
    adopter: view.adopter,
    transaction: view.transaction,
    account: view.account,
    slot: view.slot === null ? null : view.slot.toString(),
    registeredAt: view.registeredAt === null ? null : view.registeredAt.toISOString(),
  }
}
