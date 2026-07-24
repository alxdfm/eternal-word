import { WEB_API_URL } from './env'

/** Verse status as the read API returns it (JSON-safe: slot is a string). */
export interface VerseStatus {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string | null
  readonly registrable: boolean
  readonly status: string | null
  readonly adopter: string | null
  readonly transaction: string | null
  readonly account: string | null
  readonly slot: string | null
  readonly registeredAt: string | null
}

/** Text + Merkle proof (hex siblings) for building the register transaction. */
export interface RegistrationProof {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly text: string
  readonly proof: readonly string[]
}

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
