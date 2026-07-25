import type { RegistrationProofDto, VerseStatusDto } from '@eternal-word/shared/contracts'
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

function apiUrl(path: string): string {
  if (WEB_API_URL === '') {
    throw new Error('NEXT_PUBLIC_WEB_API_URL is not set')
  }
  return `${WEB_API_URL.replace(/\/$/, '')}${path}`
}

export async function fetchVerse(
  book: number,
  chapter: number,
  verse: number,
): Promise<VerseStatus> {
  const res = await fetch(apiUrl(`/?book=${book}&chapter=${chapter}&verse=${verse}`))
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
