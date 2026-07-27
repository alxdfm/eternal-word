// Rate limit token-bucket, com chave por origem (IP). Best-effort e
// **por-instância**: cada container Lambda quente tem o próprio balde, então o
// teto real é (instâncias vivas × limite). Não substitui um rate limit de borda
// (CloudFront/WAF) nem a `reserved concurrency` — que é o teto de custo real —,
// mas corta abuso ingênuo, sobretudo do caminho de escrita (POST /pending), sem
// custo nem infra nova. Ver ADR 2026-07-27_rpc-e-custo-mainnet.

export interface RateLimitResult {
  readonly allowed: boolean
  /** Quanto esperar (ms) até o próximo token, quando negado. 0 quando permitido. */
  readonly retryAfterMs: number
}

export interface RateLimiterOptions {
  /** Tokens no balde cheio — o burst máximo. */
  readonly capacity: number
  /** Reabastecimento por segundo — a taxa sustentada. */
  readonly refillPerSec: number
  /** Injeção do relógio, para teste determinístico. */
  readonly now?: () => number
}

interface Bucket {
  tokens: number
  updatedAt: number
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private readonly capacity: number
  private readonly refillPerMs: number
  private readonly now: () => number

  constructor(opts: RateLimiterOptions) {
    this.capacity = opts.capacity
    this.refillPerMs = opts.refillPerSec / 1000
    this.now = opts.now ?? Date.now
  }

  /** Consome `cost` tokens de `key`. Reabastece proporcional ao tempo decorrido,
   * com teto na capacidade. Não gasta tokens quando nega. */
  take(key: string, cost = 1): RateLimitResult {
    const t = this.now()
    const current = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: t }
    const refilled = Math.min(
      this.capacity,
      current.tokens + (t - current.updatedAt) * this.refillPerMs,
    )
    if (refilled >= cost) {
      this.buckets.set(key, { tokens: refilled - cost, updatedAt: t })
      return { allowed: true, retryAfterMs: 0 }
    }
    // Nega sem consumir: guarda o saldo reabastecido e diz quando voltar.
    this.buckets.set(key, { tokens: refilled, updatedAt: t })
    const deficit = cost - refilled
    return { allowed: false, retryAfterMs: Math.ceil(deficit / this.refillPerMs) }
  }

  /** Remove baldes ociosos para o Map não crescer sem limite numa instância
   * longeva. Chamado esporadicamente pelo handler. */
  prune(maxIdleMs: number): void {
    const t = this.now()
    for (const [key, bucket] of this.buckets) {
      if (t - bucket.updatedAt > maxIdleMs) this.buckets.delete(key)
    }
  }

  /** Só para teste/observabilidade: quantos baldes ativos. */
  size(): number {
    return this.buckets.size
  }
}
