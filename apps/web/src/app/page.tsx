'use client'

import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Main = styled.main`
  min-height: 100dvh;
  display: grid;
  place-content: center;
  gap: 0.5rem;
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
  return (
    <Main>
      <Title>{t('title')}</Title>
      <Subtitle>{t('subtitle')}</Subtitle>
    </Main>
  )
}
