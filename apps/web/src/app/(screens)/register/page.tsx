'use client'

import { RegisterPanel } from '@/components/register-panel'
import { SearchForm } from '@/components/search-form'
import { Section, SectionHead, Wrap } from '@/components/ui'
import type { VerseReference } from '@/lib/api'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import styled from 'styled-components'

const PanelWrap = styled.div`
  display: grid;
  justify-items: center;
  gap: 20px;
  margin-top: 12px;
`
const ChapterLink = styled(Link)`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.color.lapis};
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`

/**
 * Dedicated registration screen (UX-09). Pick a verse by reference, see its
 * live status, and — when AVAILABLE — inscribe it on-chain from the wallet.
 * Moved out of the home hero so the landing page stays a landing page; the
 * SearchForm + RegisterPanel are the same components the home used to embed.
 */
export default function RegisterPage() {
  const t = useTranslations('registerScreen')
  const [reference, setReference] = useState<VerseReference | null>(null)

  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
        <PanelWrap>
          <SearchForm onSearch={setReference} />
          {reference !== null && (
            <>
              <RegisterPanel
                key={`${reference.book}:${reference.chapter}:${reference.verse}`}
                reference={reference}
              />
              <ChapterLink href={`/chapter/${reference.book}/${reference.chapter}`}>
                {t('viewChapter')} →
              </ChapterLink>
            </>
          )}
        </PanelWrap>
      </Wrap>
    </Section>
  )
}
