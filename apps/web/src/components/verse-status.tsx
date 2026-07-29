'use client'

import { VerseStateChip } from '@/components/verse-state-chip'
import type { VerseStatus as VerseStatusData } from '@/lib/api'
import { shortenAddress } from '@/lib/format'
import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Box = styled.div`
  display: grid;
  gap: 0.4rem;
  justify-items: center;
`

const Muted = styled.span`
  color: ${({ theme }) => theme.color.muted};
  font-size: 0.875rem;
`

const Detail = styled.span`
  max-width: 32rem;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.color.faint};
  word-break: break-all;
`

interface VerseStatusViewProps {
  readonly data: VerseStatusData | undefined
  readonly isPending: boolean
  readonly isError: boolean
  /** The reference is outside the canon (404) — a clear note, not a generic error. */
  readonly notInCanon?: boolean
}

/**
 * Presentational live status of one verse — the design-system state chip plus,
 * once registered, the adopter. The query (and its polling) lives in
 * RegisterPanel, which passes the result down — one subscription per reference.
 */
export function VerseStatus({ data, isPending, isError, notInCanon }: VerseStatusViewProps) {
  const t = useTranslations('status')

  if (notInCanon) {
    return (
      <Box>
        <Muted>{t('notInCanon')}</Muted>
      </Box>
    )
  }
  if (isPending) {
    return (
      <Box>
        <Muted>{t('loading')}</Muted>
      </Box>
    )
  }
  if (isError || data === undefined) {
    return (
      <Box>
        <Muted>{t('unavailable')}</Muted>
      </Box>
    )
  }
  if (!data.registrable) {
    return (
      <Box>
        <Muted>{t('notRegistrable')}</Muted>
      </Box>
    )
  }

  return (
    <Box>
      {data.status === 'FAILED' ? (
        <Muted>{t('failed')}</Muted>
      ) : (
        <VerseStateChip status={data.status} />
      )}
      {data.status === 'REGISTERED' && data.adopter !== null && (
        <Detail>{t('adopter', { address: shortenAddress(data.adopter) })}</Detail>
      )}
    </Box>
  )
}
