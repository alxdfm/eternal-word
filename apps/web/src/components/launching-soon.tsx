'use client'

import { useTranslations } from 'next-intl'
import styled from 'styled-components'

const Notice = styled.div`
  display: grid;
  gap: 6px;
  justify-items: center;
  text-align: center;
  width: 100%;
  max-width: 40rem;
  padding: 16px 18px;
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.color.panel};
  .badge {
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.gold};
    border: 1px solid ${({ theme }) => theme.color.rule};
    border-radius: ${({ theme }) => theme.radius.pill};
    padding: 2px 10px;
  }
  .title {
    font-weight: 600;
  }
  p {
    margin: 0;
    font-size: 0.9rem;
    color: ${({ theme }) => theme.color.muted};
    max-width: 46ch;
  }
`

/**
 * "Launching soon" gate (S07). Shown wherever registration would be offered when
 * the stage is closed (mainnet before the program is deployed — cutover Fase C).
 * Browsing stays open; only the on-chain action is replaced by this notice, so
 * the empty apex never shows a register button that would fail on-chain.
 */
export function LaunchingSoon() {
  const t = useTranslations('launch')
  return (
    <Notice>
      <span className="badge">{t('soon.badge')}</span>
      <span className="title">{t('soon.title')}</span>
      <p>{t('soon.note')}</p>
    </Notice>
  )
}
