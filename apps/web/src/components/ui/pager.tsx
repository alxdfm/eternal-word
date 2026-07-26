'use client'

import { useTranslations } from 'next-intl'
import styled from 'styled-components'
import { Button } from './button'

const Bar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 18px;
`
const Status = styled.span`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.color.muted};
  font-variant-numeric: tabular-nums;
`

/** Previous / page-of / next. Bounded — the buttons disable at the ends. Pages
 * are 1-based. Renders nothing when there is a single page. */
export function Pager({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  const t = useTranslations('common')
  if (pages <= 1) {
    return null
  }
  return (
    <Bar>
      <Button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        ‹ {t('previous')}
      </Button>
      <Status>{t('page', { page, pages })}</Status>
      <Button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        {t('next')} ›
      </Button>
    </Bar>
  )
}
