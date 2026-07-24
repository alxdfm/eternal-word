'use client'

import { verseQueryKey } from '@/hooks/use-verse-status'
import { registerVerse } from '@/lib/register'
import { registerErrorKey } from '@/lib/register-error'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Button = styled.button`
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
  border: none;
  border-radius: 0.5rem;
  background: #512da8;
  color: #fff;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const Message = styled.p`
  margin: 0;
  max-width: 32rem;
  font-size: 0.875rem;
  word-break: break-word;
  color: #b91c1c;
`

interface RegisterButtonProps {
  readonly book: number
  readonly chapter: number
  readonly verse: number
}

type Phase = 'idle' | 'submitting' | 'error'

/**
 * Builds, signs and sends the register_verse transaction for one verse. On
 * success the verse is PENDING (camada 2), so it invalidates the status query —
 * VerseStatus then polls the PENDING → REGISTERED transition (WB-06). Submit-
 * time failures (declined signature, insufficient funds, expired, duplicate)
 * map to friendly messages (WB-07).
 */
export function RegisterButton({ book, chapter, verse }: RegisterButtonProps) {
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
      await queryClient.invalidateQueries({ queryKey: verseQueryKey(book, chapter, verse) })
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

  return (
    <>
      <Button type="button" onClick={onRegister} disabled={!connected || phase === 'submitting'}>
        {phase === 'submitting' ? t('submitting') : t('register')}
      </Button>
      {phase === 'error' && error !== null && <Message>{error}</Message>}
    </>
  )
}
