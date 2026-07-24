// Endpoint RPC da Solana no cliente. NEXT_PUBLIC_ é inlined no bundle — é uma
// URL pública de RPC, não segredo. Devnet por padrão; mainnet é troca de env na
// S07 (princípio guia da S04: nada "só de devnet" a refazer).
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
