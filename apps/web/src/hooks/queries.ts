'use client'

import * as api from '@/lib/api'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

// TanStack Query hooks over the read API. `keepPreviousData` keeps the previous
// page/results on screen while the next loads, so paging and live search don't
// flash empty.

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: api.fetchDashboard })

export const useVerses = (filter: api.ListFilter, page: number) =>
  useQuery({
    queryKey: ['verses', filter, page],
    queryFn: () => api.fetchVerses(filter, page),
    placeholderData: keepPreviousData,
  })

export const useBookProgress = () =>
  useQuery({ queryKey: ['progress'], queryFn: api.fetchBookProgress })

export const useChapterProgress = (book: number | null) =>
  useQuery({
    queryKey: ['progress', book],
    queryFn: () => api.fetchChapterProgress(book as number),
    enabled: book !== null,
  })

export const useChapter = (book: number, chapter: number) =>
  useQuery({
    queryKey: ['chapter', book, chapter],
    queryFn: () => api.fetchChapter(book, chapter),
    enabled: book > 0 && chapter > 0,
    // A 404 means the chapter isn't in the canon — a note, not a transient
    // failure, so don't retry it (mirrors the single-verse 404, UX-01).
    retry: (failureCount, error) =>
      !(error instanceof api.ChapterNotFoundError) && failureCount < 3,
  })

export const useSearch = (query: string, page = 1) =>
  useQuery({
    queryKey: ['search', query, page],
    queryFn: () => api.fetchSearch(query, page),
    enabled: query.trim() !== '',
    placeholderData: keepPreviousData,
  })

export const useAdopter = (pubkey: string, page: number) =>
  useQuery({
    queryKey: ['adopter', pubkey, page],
    queryFn: () => api.fetchAdopter(pubkey, page),
    enabled: pubkey !== '',
    placeholderData: keepPreviousData,
  })
