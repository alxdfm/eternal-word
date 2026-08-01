'use client'

import { LaunchingSoon } from '@/components/launching-soon'
import { Button } from '@/components/ui'
import { verseQueryKey } from '@/hooks/use-verse-status'
import type { VerseStatus } from '@/lib/api'
import { REGISTRATION_ENABLED } from '@/lib/env'
import { registerVerse } from '@/lib/register'
import { registerErrorKey } from '@/lib/register-error'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Message = styled.p`
  margin: 0;
  max-width: 32rem;
  font-size: 0.875rem;
  word-break: break-word;
  color: ${({ theme }) => theme.color.danger};
`

interface RegisterButtonProps {
  readonly book: number
  readonly chapter: number
  readonly verse: number
  readonly onSubmitted?: () => void
}

type Phase = 'idle' | 'submitting' | 'error'

/**
 * Builds, signs and sends the register_verse transaction for one verse. On
 * success it writes an optimistic PENDING into the query cache and calls
 * `onSubmitted`, so the status polls PENDING → REGISTERED (WB-06) even if the
 * best-effort camada-2 write missed. Submit-time failures (declined signature,
 * insufficient funds, expired, duplicate) map to friendly messages (WB-07).
 */
export function RegisterButton({ book, chapter, verse, onSubmitted }: RegisterButtonProps) {
  const t = useTranslations('register')
  const queryClient = useQueryClient()
  const { connection } = useConnection()
  const { publicKey, sendTransaction, connected } = useWallet()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onRegister(): Promise<void> {
    if (publicKey === null) {
      return
    }
    setPhase('submitting')
    setError(null)
    try {
      await registerVerse({ connection, adopter: publicKey, book, chapter, verse, sendTransaction })
      setPhase('idle')
      queryClient.setQueryData<VerseStatus>(verseQueryKey(book, chapter, verse), (old) =>
        old ? { ...old, status: 'PENDING' } : old,
      )
      onSubmitted?.()
    } catch (caught) {
      switch (registerErrorKey(caught)) {
        case 'rejected':
          setError(t('errors.rejected'))
          break
        case 'insufficient':
          setError(t('errors.insufficient'))
          break
        case 'expired':
          setError(t('errors.expired'))
          break
        case 'duplicate':
          setError(t('errors.duplicate'))
          break
        default:
          setError(
            t('errors.generic', {
              message: caught instanceof Error ? caught.message : String(caught),
            }),
          )
      }
      setPhase('error')
    }
  }

  // "Launching soon": on a closed stage (mainnet pre-launch) the action is
  // replaced by a notice — never a register button that would fail on-chain.
  if (!REGISTRATION_ENABLED) {
    return <LaunchingSoon />
  }

  return (
    <>
      <Button
        type="button"
        $variant="gold"
        onClick={onRegister}
        disabled={!connected || phase === 'submitting'}
      >
        {phase === 'submitting' ? t('submitting') : t('register')}
      </Button>
      {phase === 'error' && error !== null && <Message>{error}</Message>}
    </>
  )
}
