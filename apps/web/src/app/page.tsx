'use client'

import { RegisterPanel } from '@/components/register-panel'
import { SearchForm } from '@/components/search-form'
import { WalletButton } from '@/components/wallet-button'
import type { VerseReference } from '@/lib/api'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Main = styled.main`
  min-height: 100dvh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1.25rem;
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

export default function HomePage() {
  const t = useTranslations('home')
  const [reference, setReference] = useState<VerseReference | null>(null)
  return (
    <Main>
      <Title>{t('title')}</Title>
      <Subtitle>{t('subtitle')}</Subtitle>
      <WalletButton />
      <SearchForm onSearch={setReference} />
      {reference !== null && (
        <RegisterPanel
          key={`${reference.book}:${reference.chapter}:${reference.verse}`}
          reference={reference}
        />
      )}
    </Main>
  )
}
