import type { VerseListItem, VerseView } from '@eternal-word/application'
import type { VerseListItemDto, VerseStatusDto } from '@eternal-word/shared/contracts'

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

/** Projects a listing row onto the shared contract (registeredAt → ISO). Shared
 * by the explore listings and the adopter profile. */
export function toVerseListItemDto(item: VerseListItem): VerseListItemDto {
  return {
    book: item.book,
    chapter: item.chapter,
    verse: item.verse,
    status: item.status,
    text: item.text,
    adopter: item.adopter,
    transaction: item.transaction,
    registeredAt: item.registeredAt === null ? null : item.registeredAt.toISOString(),
  }
}
