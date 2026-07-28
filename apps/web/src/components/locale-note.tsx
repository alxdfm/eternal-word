'use client'

import { useLocale, useTranslations } from 'next-intl'
import styled from 'styled-components'
import { Wrap } from './ui'

const Strip = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.color.rule};
  background: color-mix(in oklab, ${({ theme }) => theme.color.lapis} 8%, transparent);
`
const Note = styled.p`
  margin: 0;
  padding: 7px 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: ${({ theme }) => theme.color.muted};
  text-align: center;
`

/**
 * Explains, only in a non-English locale (pt-BR today), that the **scripture
 * text stays in English** — the on-chain record is English (WEB); only the
 * interface is translated (UX-04). Renders nothing for `en`, where UI and text
 * already match.
 */
export function LocaleNote() {
  const locale = useLocale()
  const t = useTranslations('localeNote')
  if (locale === 'en') {
    return null
  }
  return (
    <Strip role="note">
      <Wrap>
        <Note>{t('text')}</Note>
      </Wrap>
    </Strip>
  )
}
