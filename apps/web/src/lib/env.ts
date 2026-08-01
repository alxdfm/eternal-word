// Endpoint RPC da Solana no cliente. NEXT_PUBLIC_ é inlined no bundle — é uma
// URL pública de RPC, não segredo. Devnet por padrão; mainnet é troca de env na
// S07 (princípio guia da S04: nada "só de devnet" a refazer).
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'

// Base URL of the web API (read + proof + PENDING), a Lambda Function URL. Set
// per stage at build/deploy time (WB-08); no default — the app fails loud if a
// build forgets it rather than silently calling nowhere.
export const WEB_API_URL = process.env.NEXT_PUBLIC_WEB_API_URL ?? ''

// Registration gate (S07 "launching soon"). True everywhere by default —
// devnet and local dev keep working with zero config. The mainnet (`production`)
// stage starts CLOSED: sst.config.ts injects 'false' there until the program is
// deployed, then it's flipped on with the RegistrationLive secret + a redeploy
// (cutover Fase C). Only 'false' closes it; anything else (or absent) is open.
export const REGISTRATION_ENABLED = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== 'false'
