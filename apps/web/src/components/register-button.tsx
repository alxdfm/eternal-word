'use client'

import { registerVerse } from '@/lib/register'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
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
  word-break: break-all;
  color: #6b7280;
`

interface RegisterButtonProps {
  readonly book: number
  readonly chapter: number
  readonly verse: number
}

type Phase = 'idle' | 'submitting' | 'sent' | 'error'

/**
 * Builds, signs and sends the register_verse transaction for one verse. The
 * live PENDING → REGISTERED transition is wired in WB-06; here the button just
 * proves the client can register. The reference is a prop so WB-07's search can
 * supply it.
 */
export function RegisterButton({ book, chapter, verse }: RegisterButtonProps) {
  const t = useTranslations('register')
  const { connection } = useConnection()
  const { publicKey, sendTransaction, connected } = useWallet()
  const [phase, setPhase] = useState<Phase>('idle')
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onRegister(): Promise<void> {
    if (publicKey === null) {
      return
    }
    setPhase('submitting')
    setError(null)
    try {
      const sig = await registerVerse({
        connection,
        adopter: publicKey,
        book,
        chapter,
        verse,
        sendTransaction,
      })
      setSignature(sig)
      setPhase('sent')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setPhase('error')
    }
  }

  return (
    <>
      <Button type="button" onClick={onRegister} disabled={!connected || phase === 'submitting'}>
        {phase === 'submitting' ? t('submitting') : t('register')}
      </Button>
      {phase === 'sent' && signature !== null && <Message>{t('sent', { signature })}</Message>}
      {phase === 'error' && error !== null && <Message>{t('error', { message: error })}</Message>}
    </>
  )
}
