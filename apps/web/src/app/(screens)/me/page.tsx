'use client'

import { AdopterProfile } from '@/components/adopter-profile'
import { Section, Serif, Wrap } from '@/components/ui'
import { WalletButton } from '@/components/wallet-button'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Connect = styled.div`
  display: grid;
  gap: 16px;
  justify-items: start;
  p {
    margin: 0;
    color: ${({ theme }) => theme.color.muted};
    max-width: 46ch;
  }
`

/**
 * "My registrations" (UX follow-up): the adopter profile for the *connected*
 * wallet — no need to know or paste your own pubkey. Reuses {@link AdopterProfile};
 * `/adopter/[pubkey]` still serves any wallet. Disconnected → a connect prompt.
 */
export default function MePage() {
  const t = useTranslations('profile')
  const { publicKey, connected } = useWallet()

  return (
    <Section>
      <Wrap>
        <div style={{ marginBottom: 26 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {t('myEyebrow')}
          </p>
          <Serif style={{ fontSize: '1.6rem', fontWeight: 600 }}>{t('myTitle')}</Serif>
        </div>

        {connected && publicKey !== null ? (
          <AdopterProfile pubkey={publicKey.toBase58()} />
        ) : (
          <Connect>
            <p>{t('connectPrompt')}</p>
            <WalletButton />
          </Connect>
        )}
      </Wrap>
    </Section>
  )
}
