import { createVerseAddress } from '@eternal-word/domain'
import { isErr } from '@eternal-word/shared'
import type { VerseReadRepository } from './ports.js'
import type { VerseView } from './verse-view.js'

/**
 * Outcome of a verse lookup by reference. `invalid` is a malformed reference
 * (out of the canonical range); `not-found` is a well-formed reference not in
 * the versification at all; `found` carries the view (which may itself be a
 * non-registrable omitted position). The HTTP mapping lives in apps/api.
 */
export type VerseLookup =
  | { readonly kind: 'found'; readonly view: VerseView }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'invalid'; readonly reason: string }

export async function lookupVerse(
  repo: VerseReadRepository,
  book: number,
  chapter: number,
  verse: number,
): Promise<VerseLookup> {
  const address = createVerseAddress(book, chapter, verse)
  if (isErr(address)) {
    return { kind: 'invalid', reason: address.error }
  }
  const view = await repo.findByAddress(address.data)
  return view === null ? { kind: 'not-found' } : { kind: 'found', view }
}
