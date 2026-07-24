import {
  createChapterTextReader,
  createDatabase,
  createVerseReadRepository,
  databaseUrlFromEnv,
} from '@eternal-word/infrastructure'

function build() {
  const db = createDatabase(databaseUrlFromEnv())
  return {
    readRepo: createVerseReadRepository(db),
    chapterReader: createChapterTextReader(db),
  }
}

export type WebContext = ReturnType<typeof build>

let cached: WebContext | undefined

/** Built once per warm container and reused. The web API needs only the DB —
 * no Solana RPC — so its context is leaner than the indexer's. */
export function webContext(): WebContext {
  cached ??= build()
  return cached
}
