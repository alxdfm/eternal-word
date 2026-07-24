'use client'

import { useVerseStatus } from '@/hooks/use-verse-status'
import type { VerseReference } from '@/lib/api'
import { shortenAddress } from '@/lib/format'
import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Box = styled.div`
  display: grid;
  gap: 0.25rem;
  justify-items: center;
`

const Badge = styled.span`
  font-weight: 600;
`

const Detail = styled.span`
  max-width: 32rem;
  font-size: 0.8125rem;
  color: #6b7280;
  word-break: break-all;
`

/**
 * Live status of one verse. Shows AVAILABLE / PENDING / REGISTERED / FAILED and,
 * once registered, the adopter — polling underneath (see useVerseStatus) so the
 * PENDING → REGISTERED transition appears on its own.
 */
export function VerseStatus({ reference }: { reference: VerseReference }) {
  const t = useTranslations('status')
  const { data, isPending, isError } = useVerseStatus(reference)

  if (isPending) {
    return <Box>{t('loading')}</Box>
  }
  if (isError || data === undefined) {
    return <Box>{t('unavailable')}</Box>
  }
  if (!data.registrable) {
    return <Box>{t('notRegistrable')}</Box>
  }

  const labels: Record<string, string> = {
    AVAILABLE: t('available'),
    PENDING: t('pending'),
    REGISTERED: t('registered'),
    FAILED: t('failed'),
  }
  const label = data.status !== null ? (labels[data.status] ?? data.status) : ''

  return (
    <Box>
      <Badge>{label}</Badge>
      {data.status === 'REGISTERED' && data.adopter !== null && (
        <Detail>{t('adopter', { address: shortenAddress(data.adopter) })}</Detail>
      )}
    </Box>
  )
}
