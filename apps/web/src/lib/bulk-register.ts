import type { VersionedTransaction } from '@solana/web3.js'
import type { VerseReference } from './api'
import { registerErrorKey } from './register-error'

/** Progress of a bulk run: how many of the selected verses have settled
 * (succeeded or failed), out of the total. */
export interface BulkProgress {
  readonly done: number
  readonly total: number
}

export interface BulkFailure {
  readonly reference: VerseReference
  readonly error: unknown
}

export interface BulkRegisterOutcome {
  readonly succeeded: readonly VerseReference[]
  readonly failed: readonly BulkFailure[]
  /** True when a batch signature was declined — the run stopped early and the
   * remaining verses were not attempted. */
  readonly aborted: boolean
}

/**
 * The IO a bulk run needs, injected so the orchestration (batching, concurrency,
 * retry, abort) is testable without a wallet, an RPC or the network. The button
 * wires the real implementations (blockhash + proof/tx build + wallet
 * signAllTransactions + sendRawTransaction).
 */
export interface BulkRegisterIO {
  /** A fresh recent blockhash for a batch — its ~60-90s validity bounds the
   * batch size (D3: re-sign per batch so a big chapter never expires). */
  getBlockhash(): Promise<string>
  buildTransaction(
    reference: VerseReference,
    recentBlockhash: string,
  ): Promise<VersionedTransaction>
  /** One wallet approval for the whole batch. */
  signAll(transactions: readonly VersionedTransaction[]): Promise<readonly VersionedTransaction[]>
  send(transaction: VersionedTransaction): Promise<string>
}

export interface BulkRegisterOptions {
  /** Verses per batch = per blockhash = per wallet approval. */
  readonly batchSize?: number
  readonly sendConcurrency?: number
  readonly sendAttempts?: number
  readonly onProgress?: (progress: BulkProgress) => void
}

const DEFAULT_BATCH_SIZE = 25
const DEFAULT_SEND_CONCURRENCY = 5
const DEFAULT_SEND_ATTEMPTS = 3

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Runs `fn` over `items` with at most `limit` in flight, preserving order of
 * completion effects only through `fn` itself (each call is independent). */
async function forEachLimit<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index] as T)
    }
  })
  await Promise.all(workers)
}

/** Sends one already-signed transaction, retrying transient failures. A
 * duplicate (verse already registered) or a declined signature is terminal —
 * retrying can't help — so it throws immediately. */
async function sendWithRetry(
  io: BulkRegisterIO,
  transaction: VersionedTransaction,
  attempts: number,
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await io.send(transaction)
    } catch (error) {
      lastError = error
      const kind = registerErrorKey(error)
      if (kind === 'duplicate' || kind === 'rejected') {
        throw error
      }
      if (attempt < attempts - 1) {
        await sleep(300 * (attempt + 1))
      }
    }
  }
  throw lastError
}

/**
 * Registers many verses in one flow (UX-11), reusing the single-verse
 * transaction (no packing, no new program instruction — ADR
 * 2026-07-29_registro-em-lote). Per batch: one fresh blockhash, build each
 * transaction, one `signAll` (a single wallet approval), then send with bounded
 * concurrency and per-verse retry. A declined signature aborts the whole run;
 * everything else is a partial failure the caller can retry. The mirror is
 * never written here — the indexer promotes to REGISTERED.
 */
export async function bulkRegisterVerses(
  references: readonly VerseReference[],
  io: BulkRegisterIO,
  options: BulkRegisterOptions = {},
): Promise<BulkRegisterOutcome> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const sendConcurrency = options.sendConcurrency ?? DEFAULT_SEND_CONCURRENCY
  const sendAttempts = options.sendAttempts ?? DEFAULT_SEND_ATTEMPTS

  const succeeded: VerseReference[] = []
  const failed: BulkFailure[] = []
  const total = references.length
  let done = 0
  const advance = () => options.onProgress?.({ done: ++done, total })

  for (const batch of chunk(references, batchSize)) {
    // No blockhash (e.g. the public RPC throttling the burst — S06) fails this
    // batch, not the whole run: mark its verses failed and try the next batch,
    // so a transient blip never throws away the partial result.
    let blockhash: string
    try {
      blockhash = await io.getBlockhash()
    } catch (error) {
      for (const reference of batch) {
        failed.push({ reference, error })
        advance()
      }
      continue
    }

    // Build every transaction in the batch (proof fetch + assembly). A build
    // failure fails just that verse; the batch goes on.
    const built: { reference: VerseReference; transaction: VersionedTransaction }[] = []
    for (const reference of batch) {
      try {
        const transaction = await io.buildTransaction(reference, blockhash)
        built.push({ reference, transaction })
      } catch (error) {
        failed.push({ reference, error })
        advance()
      }
    }
    if (built.length === 0) {
      continue
    }

    // One approval for the batch. A rejection stops the whole run.
    let signed: readonly VersionedTransaction[]
    try {
      signed = await io.signAll(built.map((b) => b.transaction))
    } catch (error) {
      for (const b of built) {
        failed.push({ reference: b.reference, error })
        advance()
      }
      return { succeeded, failed, aborted: true }
    }

    await forEachLimit(
      built.map((b, index) => ({
        reference: b.reference,
        transaction: signed[index] as VersionedTransaction,
      })),
      sendConcurrency,
      async ({ reference, transaction }) => {
        try {
          await sendWithRetry(io, transaction, sendAttempts)
          succeeded.push(reference)
        } catch (error) {
          failed.push({ reference, error })
        } finally {
          advance()
        }
      },
    )
  }

  return { succeeded, failed, aborted: false }
}
