'use client'

import { Button } from '@/components/ui'
import type { VerseReference } from '@/lib/api'
import {
  type BulkProgress,
  type BulkRegisterIO,
  type BulkRegisterOutcome,
  bulkRegisterVerses,
} from '@/lib/bulk-register'
import { buildRegisterTransaction } from '@/lib/register'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import type { VersionedTransaction } from '@solana/web3.js'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Summary = styled.span`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.color.muted};
`

interface Props {
  readonly references: readonly VerseReference[]
  readonly onComplete?: (outcome: BulkRegisterOutcome) => void
}

/**
 * Registers the verses selected in the chapter view in one flow (UX-11): builds
 * a single-verse transaction for each, signs a batch with one wallet approval,
 * and sends with retry. Progress shows `done/total`; a declined signature aborts
 * the run. The heavy lifting (batching, concurrency, retry) is in
 * {@link bulkRegisterVerses} — here we only wire the wallet + RPC IO.
 */
export function BulkRegisterButton({ references, onComplete }: Props) {
  const t = useTranslations('register')
  const { connection } = useConnection()
  const { publicKey, signAllTransactions, connected } = useWallet()
  const [progress, setProgress] = useState<BulkProgress | null>(null)
  const [summary, setSummary] = useState<BulkRegisterOutcome | null>(null)

  const canSign = connected && publicKey !== null && signAllTransactions !== undefined
  const running = progress !== null

  async function onClick(): Promise<void> {
    if (!canSign || publicKey === null || signAllTransactions === undefined) {
      return
    }
    if (references.length === 0) {
      return
    }
    setSummary(null)
    setProgress({ done: 0, total: references.length })

    const io: BulkRegisterIO = {
      getBlockhash: async () => (await connection.getLatestBlockhash()).blockhash,
      buildTransaction: (reference, recentBlockhash) =>
        buildRegisterTransaction({
          adopter: publicKey,
          book: reference.book,
          chapter: reference.chapter,
          verse: reference.verse,
          recentBlockhash,
        }),
      signAll: (transactions) => signAllTransactions([...transactions] as VersionedTransaction[]),
      send: (transaction) =>
        connection.sendRawTransaction(transaction.serialize(), { maxRetries: 5 }),
    }

    const outcome = await bulkRegisterVerses(references, io, { onProgress: setProgress })
    setProgress(null)
    setSummary(outcome)
    onComplete?.(outcome)
  }

  return (
    <>
      <Button
        type="button"
        $variant="gold"
        onClick={onClick}
        disabled={!canSign || references.length === 0 || running}
      >
        {running && progress
          ? t('bulkProgress', { done: progress.done, total: progress.total })
          : t('bulk', { count: references.length })}
      </Button>
      {summary !== null &&
        (summary.aborted ? (
          <Summary>{t('errors.rejected')}</Summary>
        ) : (
          <Summary>
            {t('bulkDone', { succeeded: summary.succeeded.length, failed: summary.failed.length })}
          </Summary>
        ))}
    </>
  )
}
