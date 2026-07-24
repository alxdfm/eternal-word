'use client'

import { RegisterButton } from '@/components/register-button'
import { WalletButton } from '@/components/wallet-button'
import { shortenAddress } from '@/lib/format'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Main = styled.main`
  min-height: 100dvh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
`

const Title = styled.h1`
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
`

const Subtitle = styled.p`
  margin: 0;
  color: #6b7280;
`

const Status = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
`

export default function HomePage() {
  const t = useTranslations('home')
  const { connected, publicKey } = useWallet()
  return (
    <Main>
      <Title>{t('title')}</Title>
      <Subtitle>{t('subtitle')}</Subtitle>
      <WalletButton />
      <Status>
        {connected && publicKey
          ? t('wallet.connected', { address: shortenAddress(publicKey.toBase58()) })
          : t('wallet.disconnected')}
      </Status>
      {/* Fixed reference until WB-07 wires the search. */}
      <RegisterButton book={1} chapter={1} verse={1} />
    </Main>
  )
}
