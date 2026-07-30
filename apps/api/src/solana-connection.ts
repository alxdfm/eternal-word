import { Connection } from '@solana/web3.js'

type FetchLike = typeof fetch

/** Default devnet RPC — the fallback when `SOLANA_RPC_URL` is unset. One source
 * of truth for the two entrypoints (context, CLI). */
export const DEFAULT_RPC_URL = 'https://api.devnet.solana.com'

/**
 * Per-call RPC timeout (ms). Generous enough for a large `getProgramAccounts` on
 * mainnet (reconcile reads every VerseAccount), yet well under the Lambda's 120s:
 * a hung socket fails fast instead of burning the whole invocation. Tunable per
 * cluster via env.
 */
const DEFAULT_RPC_TIMEOUT_MS = 60_000

function rpcTimeoutMs(): number {
  const raw = Number(process.env.SOLANA_RPC_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RPC_TIMEOUT_MS
}

/**
 * Wraps a fetch so every call aborts after `timeoutMs`. web3.js v1 exposes no
 * per-call timeout on `getProgramAccounts`/`getSlot`, so the cut lives here and
 * applies to every RPC call. The base fetch is a parameter so the timeout is
 * testable without stubbing globals.
 */
export function withTimeout(baseFetch: FetchLike, timeoutMs: number): FetchLike {
  return async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await baseFetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * web3.js `Connection` with a fail-fast timeout on every RPC call. This is the
 * resilience that makes a formal circuit breaker unnecessary: the account
 * concurrency cap bounds the blast radius and the `IndexerDown` alarm (R4)
 * catches sustained failure; here we only ensure a single call never hangs.
 */
export function createSolanaConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    fetch: withTimeout(fetch, rpcTimeoutMs()),
  })
}
