'use client'

import { type VerseReference, type VerseStatus, fetchVerse } from '@/lib/api'
import { type UseQueryResult, useQuery } from '@tanstack/react-query'

export function verseQueryKey(book: number, chapter: number, verse: number) {
  return ['verse', book, chapter, verse] as const
}

/**
 * Reads a verse's status and keeps it live: while PENDING it polls the read API
 * so the indexer's promotion to REGISTERED (camada 1) shows up without a
 * reload, then stops polling once the status is terminal.
 */
export function useVerseStatus(reference: VerseReference | null): UseQueryResult<VerseStatus> {
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
    // ~1s webhook freshness, so 2.5s is plenty; stop once no longer PENDING.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 2500 : false),
  })
}
