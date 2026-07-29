'use client'

import { Eyebrow, Lead, Meter, Section, Wrap } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useDashboard } from '@/hooks/queries'
import { useBookLabels } from '@/hooks/use-books'
import { fetchVerse } from '@/lib/api'
import { shortenAddress } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import styled from 'styled-components'

// The hero showcases the first verse registered on-chain (John 3:16, WB-09).
const HERO_VERSE = { book: 43, chapter: 3, verse: 16 }

const HeroGrid = styled.div`
  display: grid;
  grid-template-columns: 1.02fr 0.98fr;
  gap: 52px;
  align-items: center;
  padding-top: 40px;
  @media (max-width: 920px) {
    grid-template-columns: 1fr;
    gap: 34px;
  }
`
const Title = styled.h1`
  font-family: ${({ theme }) => theme.font.serif};
  font-weight: 600;
  font-size: clamp(2.1rem, 4.6vw, 3.25rem);
  line-height: 1.06;
  letter-spacing: -0.01em;
  margin: 0.5rem 0 0;
  text-wrap: balance;
  .lit {
    color: ${({ theme }) => theme.color.gold};
    text-shadow: ${({ theme }) => theme.shadow.glow};
  }
`
const Counter = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: ${({ theme }) => theme.font.serif};
  margin-top: 24px;
  .big {
    font-size: clamp(2.6rem, 6vw, 3.6rem);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  .of {
    font-size: 1.05rem;
    color: ${({ theme }) => theme.color.muted};
  }
`
const Caption = styled.div`
  margin-top: 9px;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.color.muted};
  display: flex;
  justify-content: space-between;
  gap: 12px;
  b {
    color: ${({ theme }) => theme.color.gold};
    font-variant-numeric: tabular-nums;
  }
`
const Ctas = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 28px;
`
const ctaBase = `
  font-size: 0.85rem;
  font-weight: 600;
  padding: 9px 16px;
  border-radius: 100px;
  text-decoration: none;
`
const CtaPrimary = styled(Link)`
  ${ctaBase}
  color: ${({ theme }) => theme.color.goldOn};
  background: ${({ theme }) => theme.color.gold};
  border: 1px solid ${({ theme }) => theme.color.gold};
  box-shadow: ${({ theme }) => theme.shadow.glow};
`
const CtaGhost = styled(Link)`
  ${ctaBase}
  color: ${({ theme }) => theme.color.muted};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.color.rule};
  &:hover {
    color: ${({ theme }) => theme.color.text};
    border-color: ${({ theme }) => theme.color.lapisSoft};
  }
`

const VerseCard = styled.figure`
  position: relative;
  margin: 0;
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: 16px;
  padding: 26px;
  box-shadow: ${({ theme }) => theme.shadow.card};
`
const VcTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  .ref {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: 1.15rem;
  }
`
const VerseText = styled.p`
  font-family: ${({ theme }) => theme.font.serif};
  font-size: 1.28rem;
  line-height: 1.5;
  margin: 0;
  &::first-letter {
    font-size: 2.6rem;
    line-height: 1;
    float: left;
    padding: 4px 8px 0 0;
    color: ${({ theme }) => theme.color.gold};
    text-shadow: ${({ theme }) => theme.shadow.glow};
  }
`
const Proof = styled.dl`
  margin: 20px 0 0;
  border-top: 1px solid ${({ theme }) => theme.color.rule};
  padding-top: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px 20px;
  .row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .row.wide {
    grid-column: 1 / -1;
  }
  dt {
    font-size: 0.66rem;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.faint};
  }
  dd {
    margin: 0;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.82rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  dd.gold {
    color: ${({ theme }) => theme.color.gold};
  }
`
function HeroCounter() {
  const t = useTranslations('hero')
  const f = useFormatter()
  const { data } = useDashboard()
  if (data === undefined) {
    return null
  }
  const ratio = data.total > 0 ? data.registered / data.total : 0
  return (
    <>
      <Counter>
        <span className="big">{f.number(data.registered)}</span>
        <span className="of">
          / {f.number(data.total)} {t('illuminated')}
        </span>
      </Counter>
      <div style={{ marginTop: 16 }}>
        <Meter ratio={ratio} label={t('illuminated')} />
      </div>
      <Caption>
        <span>
          <b>{f.number(ratio, { style: 'percent', maximumFractionDigits: 2 })}</b> {t('ofCanon')}
        </span>
        <span>{t('stillDark', { count: data.total - data.registered })}</span>
      </Caption>
    </>
  )
}

function HeroVerse() {
  const t = useTranslations('hero')
  const f = useFormatter()
  const labels = useBookLabels()
  const { data } = useQuery({
    queryKey: ['verse', HERO_VERSE.book, HERO_VERSE.chapter, HERO_VERSE.verse],
    queryFn: () => fetchVerse(HERO_VERSE.book, HERO_VERSE.chapter, HERO_VERSE.verse),
  })
  const reference = labels.reference(HERO_VERSE.book, HERO_VERSE.chapter, HERO_VERSE.verse)
  const registered = data?.status === 'REGISTERED'
  return (
    <VerseCard>
      <VcTop>
        <span className="ref">{reference}</span>
        {data && <VerseStateChip status={data.status} />}
      </VcTop>
      {data?.text && <VerseText>{data.text}</VerseText>}
      {registered && data && (
        <Proof>
          <div className="row">
            <dt>{t('proofAdopter')}</dt>
            <dd className="gold" title={data.adopter ?? ''}>
              {data.adopter ? shortenAddress(data.adopter) : '—'}
            </dd>
          </div>
          <div className="row">
            <dt>{t('proofSlot')}</dt>
            <dd>{data.slot ? f.number(Number(data.slot)) : '—'}</dd>
          </div>
          <div className="row">
            <dt>{t('proofAccount')}</dt>
            <dd title={data.account ?? ''}>{data.account ? shortenAddress(data.account) : '—'}</dd>
          </div>
          <div className="row">
            <dt>{t('proofRegistered')}</dt>
            <dd>
              {data.registeredAt
                ? f.dateTime(new Date(data.registeredAt), { dateStyle: 'medium' })
                : '—'}
            </dd>
          </div>
          <div className="row wide">
            <dt>{t('proofTransaction')}</dt>
            <dd title={data.transaction ?? ''}>
              {data.transaction ? shortenAddress(data.transaction) : '—'}
            </dd>
          </div>
        </Proof>
      )}
    </VerseCard>
  )
}

export default function HomePage() {
  const t = useTranslations('hero')

  return (
    <>
      <Section>
        <Wrap>
          <HeroGrid>
            <div>
              <Eyebrow>{t('eyebrow')}</Eyebrow>
              <Title>
                {t('titleBefore')}
                <span className="lit">{t('titleLit')}</span>
                {t('titleAfter')}
              </Title>
              <Lead style={{ fontSize: '1.06rem', maxWidth: '46ch' }}>{t('sub')}</Lead>
              <HeroCounter />
              <Ctas>
                <CtaPrimary href="/register">{t('registerCta')}</CtaPrimary>
                <CtaGhost href="/explore">{t('exploreCta')}</CtaGhost>
                <CtaGhost href="/map">{t('mapCta')}</CtaGhost>
              </Ctas>
            </div>
            <HeroVerse />
          </HeroGrid>
        </Wrap>
      </Section>
    </>
  )
}
