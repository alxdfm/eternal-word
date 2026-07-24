'use client'

import { RegisterButton } from '@/components/register-button'
import { VerseStatus } from '@/components/verse-status'
import { useVerseStatus } from '@/hooks/use-verse-status'
import type { VerseReference } from '@/lib/api'
import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Panel = styled.section`
  display: grid;
  gap: 0.75rem;
  justify-items: center;
  max-width: 40rem;
`

const Text = styled.blockquote`
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.5;
`

const Note = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
`

/**
 * The registration panel for one reference: the verse text, its live status,
 * and the right action. An omitted position (no text in the WEB) shows an
 * explanatory note instead of a register button; only an AVAILABLE verse can be
 * registered. PENDING/REGISTERED are surfaced by VerseStatus.
 */
export function RegisterPanel({ reference }: { reference: VerseReference }) {
  const t = useTranslations('panel')
  const { data, isError } = useVerseStatus(reference)

  return (
    <Panel>
      {data?.text != null && <Text>“{data.text}”</Text>}
      <VerseStatus reference={reference} />
      {isError && <Note>{t('error')}</Note>}
      {data !== undefined && !data.registrable && <Note>{t('omitted')}</Note>}
      {data?.registrable === true && data.status === 'AVAILABLE' && (
        <RegisterButton book={reference.book} chapter={reference.chapter} verse={reference.verse} />
      )}
    </Panel>
  )
}
