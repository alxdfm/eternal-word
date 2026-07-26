'use client'

import { Sparkline } from '@/components/sparkline'
import { Section, SectionHead, StateChip, Wrap } from '@/components/ui'
import { useDashboard } from '@/hooks/queries'
import { useFormatter, useTranslations } from 'next-intl'
import styled from 'styled-components'

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  @media (max-width: 920px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`
const Stat = styled.div<{ $feature?: boolean }>`
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.xl};
  padding: 18px;
  box-shadow: ${({ theme }) => theme.shadow.card};
  grid-column: ${({ $feature }) => ($feature ? 'span 2' : 'span 1')};
  display: flex;
  flex-direction: column;
  @media (max-width: 560px) {
    grid-column: span 1;
  }
  .k {
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .val {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: 2.05rem;
    line-height: 1.1;
    margin-top: 8px;
    font-variant-numeric: tabular-nums;
  }
  .val em {
    font-style: normal;
    color: ${({ theme }) => theme.color.muted};
    font-size: 1.1rem;
  }
  .sub {
    font-size: 0.78rem;
    color: ${({ theme }) => theme.color.muted};
    margin-top: 3px;
  }
  .spark {
    margin-top: auto;
    padding-top: 14px;
  }
`
const Note = styled.p`
  color: ${({ theme }) => theme.color.muted};
`

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tc = useTranslations('common')
  const f = useFormatter()
  const { data, isPending, isError } = useDashboard()

  if (isPending) {
    return (
      <Section>
        <Wrap>
          <Note>{tc('loading')}</Note>
        </Wrap>
      </Section>
    )
  }
  if (isError || data === undefined) {
    return (
      <Section>
        <Wrap>
          <Note>{tc('error')}</Note>
        </Wrap>
      </Section>
    )
  }

  const pct = data.total > 0 ? (data.registered / data.total) * 100 : 0
  const stillDark = data.total - data.registered
  const trend = data.trend.map((point) => point.cumulative)

  return (
    <Section>
      <Wrap>
        <SectionHead
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          index={t('index')}
        />
        <Stats>
          <Stat $feature>
            <div className="k">
              <StateChip state="registered" />
              {t('registeredTitle')}
            </div>
            <div className="val">
              {f.number(data.registered)} <em>/ {f.number(data.total)}</em>
            </div>
            <div className="sub">
              {t('chaptersBegun')}: {f.number(data.chaptersBegun)} / 1,189
            </div>
            <div className="spark">
              <Sparkline values={trend} label={t('trendCaption')} />
            </div>
          </Stat>

          <Stat>
            <div className="k">{t('canonProgress')}</div>
            <div className="val">
              {f.number(pct, { maximumFractionDigits: 2 })}
              <em>%</em>
            </div>
            <div className="sub">{t('stillDark', { count: stillDark })}</div>
          </Stat>

          <Stat>
            <div className="k">{t('adopters')}</div>
            <div className="val">{f.number(data.uniqueAdopters)}</div>
            <div className="sub">{t('adoptersSub')}</div>
          </Stat>

          <Stat>
            <div className="k">{t('contributed')}</div>
            <div className="val">◎ {f.number(data.estimatedSol, { maximumFractionDigits: 2 })}</div>
            <div className="sub">{t('contributedSub')}</div>
          </Stat>

          <Stat>
            <div className="k">{t('booksBegun')}</div>
            <div className="val">
              {f.number(data.booksBegun)}
              <em>/66</em>
            </div>
            <div className="sub">{t('booksSub', { count: 66 - data.booksBegun })}</div>
          </Stat>

          <Stat>
            <div className="k">{t('chaptersBegun')}</div>
            <div className="val">
              {f.number(data.chaptersBegun)}
              <em>/1,189</em>
            </div>
            <div className="sub">{t('chaptersSub')}</div>
          </Stat>
        </Stats>
      </Wrap>
    </Section>
  )
}
