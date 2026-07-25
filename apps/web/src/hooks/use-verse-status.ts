'use client'

import { type VerseReference, type VerseStatus, fetchVerse } from '@/lib/api'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'

export function verseQueryKey(book: number, chapter: number, verse: number) {
  return ['verse', book, chapter, verse] as const
}

/**
 * Reads a verse's status and keeps it live. It polls while PENDING and, when
 * `watch` is set (right after this client submits a registration), keeps polling
 * through a transient AVAILABLE until the indexer confirms — so the live
 * PENDING → REGISTERED transition survives even if the optimistic camada-2 write
 * missed. Stops once the status is terminal.
 */
export function useVerseStatus(
  reference: VerseReference | null,
  watch = false,
): UseQueryResult<VerseStatus> {
  return useQuery({
    queryKey:
      reference !== null
        ? verseQueryKey(reference.book, reference.chapter, reference.verse)
        : ['verse', 'none'],
    queryFn: () => {
      if (reference === null) {
        throw new Error('no reference')
      }
      return fetchVerse(reference.book, reference.chapter, reference.verse)
    },
    enabled: reference !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'REGISTERED' || status === 'FAILED') {
        return false
      }
      // ~1s webhook freshness, so 2.5s is plenty.
      return watch || status === 'PENDING' ? 2500 : false
    },
  })
}
