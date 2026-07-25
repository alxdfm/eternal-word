'use client'

import type { VerseStatus as VerseStatusData } from '@/lib/api'
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

interface VerseStatusViewProps {
  readonly data: VerseStatusData | undefined
  readonly isPending: boolean
  readonly isError: boolean
}

/**
 * Presentational live status of one verse: AVAILABLE / PENDING / REGISTERED /
 * FAILED and, once registered, the adopter. The query (and its polling) lives in
 * RegisterPanel, which passes the result down — one subscription per reference.
 */
export function VerseStatus({ data, isPending, isError }: VerseStatusViewProps) {
  const t = useTranslations('status')

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
