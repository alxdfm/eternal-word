import type {
  AdopterProfileDto,
  BookProgressDto,
  ChapterProgressResponseDto,
  DashboardStatsDto,
  PaginatedDto,
  RegistrationProofDto,
  SearchResponseDto,
  VerseListItemDto,
  VerseStatusDto,
} from '@eternal-word/shared/contracts'
import { WEB_API_URL } from './env'

/** A verse reference — the (book, chapter, verse) triple the app works with. */
export interface VerseReference {
  readonly book: number
  readonly chapter: number
  readonly verse: number
}

/** Read API response — shared HTTP contract with apps/api. */
export type VerseStatus = VerseStatusDto

/** Proof endpoint response — shared HTTP contract with apps/api. */
export type RegistrationProof = RegistrationProofDto

/** S05 read models — shared HTTP contracts with apps/api. */
export type Dashboard = DashboardStatsDto
export type VerseListItem = VerseListItemDto
export type VerseListPage = PaginatedDto<VerseListItemDto>
export type BookProgress = BookProgressDto
export type ChapterProgressResponse = ChapterProgressResponseDto
export type SearchResponse = SearchResponseDto
export type AdopterProfile = AdopterProfileDto

/** Explore filters (matches the API's ListFilter). */
export type ListFilter = 'recent' | 'registered' | 'pending' | 'available'

function apiUrl(path: string): string {
  if (WEB_API_URL === '') {
    throw new Error('NEXT_PUBLIC_WEB_API_URL is not set')
  }
  return `${WEB_API_URL.replace(/\/$/, '')}${path}`
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path))
  if (!res.ok) {
    throw new Error(`request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/** The reference is outside the canonical versification (e.g. Song of Solomon
 * 3:16 — chapter 3 has 11 verses). The read API answers 404; the UI shows a
 * "not in canon" note, not the generic error state (UX-01). */
export class VerseNotInCanonError extends Error {
  constructor() {
    super('reference not in the canonical versification')
    this.name = 'VerseNotInCanonError'
  }
}

export async function fetchVerse(
  book: number,
  chapter: number,
  verse: number,
): Promise<VerseStatus> {
  const res = await fetch(apiUrl(`/?book=${book}&chapter=${chapter}&verse=${verse}`))
  if (res.status === 404) {
    throw new VerseNotInCanonError()
  }
  if (!res.ok) {
    throw new Error(`verse lookup failed (${res.status})`)
  }
  return res.json() as Promise<VerseStatus>
}

export async function fetchProof(
  book: number,
  chapter: number,
  verse: number,
): Promise<RegistrationProof> {
  const res = await fetch(apiUrl(`/proof?book=${book}&chapter=${chapter}&verse=${verse}`))
  if (!res.ok) {
    throw new Error(`proof fetch failed (${res.status})`)
  }
  return res.json() as Promise<RegistrationProof>
}

export const fetchDashboard = () => getJson<Dashboard>('/dashboard')

export const fetchVerses = (filter: ListFilter, page: number, pageSize = 20) =>
  getJson<VerseListPage>(`/verses?filter=${filter}&page=${page}&pageSize=${pageSize}`)

export const fetchBookProgress = () => getJson<readonly BookProgress[]>('/progress')

export const fetchChapterProgress = (book: number) =>
  getJson<ChapterProgressResponse>(`/progress?book=${book}`)

export const fetchSearch = (query: string, limit = 20) =>
  getJson<SearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`)

export const fetchAdopter = (pubkey: string, page = 1, pageSize = 20) =>
  getJson<AdopterProfile>(
    `/adopter?pubkey=${encodeURIComponent(pubkey)}&page=${page}&pageSize=${pageSize}`,
  )

/** Camada 2: tell the API to mark the verse PENDING right after submitting. */
export async function markPending(
  book: number,
  chapter: number,
  verse: number,
  transaction: string,
): Promise<void> {
  const res = await fetch(apiUrl('/pending'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ book, chapter, verse, transaction }),
  })
  if (!res.ok) {
    throw new Error(`mark pending failed (${res.status})`)
  }
}
