import type { VerseAddress } from '@eternal-word/domain'
import type { VerseView } from './verse-view.js'

/**
 * The mirror's read side — the web's window into a verse. Kept separate from
 * {@link VerseRepository} (the sync write side) so a read never reaches for a
 * write method. The Drizzle adapter lives in infrastructure (FD-10).
 */
export interface VerseReadRepository {
  /**
   * The canonical view of one address, or null when the reference is not in the
   * versification at all (invalid — as opposed to merely omitted, which returns
   * a view with `registrable` false).
   */
  findByAddress(address: VerseAddress): Promise<VerseView | null>
}
