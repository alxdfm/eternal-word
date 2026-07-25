import type { VerseView } from '@eternal-word/application'
import type { VerseStatusDto } from '@eternal-word/shared/contracts'

/**
 * Server projection of a {@link VerseView} onto the shared HTTP contract
 * ({@link VerseStatusDto}): the bigint `slot` becomes a string and
 * `registeredAt` an ISO timestamp. The web consumes the same type.
 */
export type VerseDto = VerseStatusDto

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
