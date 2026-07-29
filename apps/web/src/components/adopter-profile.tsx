'use client'

import { Pager, Serif, heatBackground } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useAdopter } from '@/hooks/queries'
import { useBookLabels } from '@/hooks/use-books'
import { REGISTRABLE_VERSE_COUNT } from '@/lib/books'
import { shortenAddress, solFractionDigits } from '@/lib/format'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import styled from 'styled-components'

const Profile = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`
const Panel = styled.div`
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius['2xl']};
  box-shadow: ${({ theme }) => theme.shadow.card};
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  @media (max-width: 560px) {
    padding: 18px;
  }
`
const Top = styled.div`
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 20px;
  .avatar {
    width: 52px;
    height: 52px;
    border-radius: 13px;
    flex: none;
    background: radial-gradient(
      circle at 32% 28%,
      ${({ theme }) => theme.color.goldLit},
      ${({ theme }) => theme.color.gold} 55%,
      ${({ theme }) => theme.color.lapis} 160%
    );
    box-shadow: ${({ theme }) => theme.shadow.glow};
  }
  .who {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.95rem;
  }
`
const Metrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 18px 0;
  border-top: 1px solid ${({ theme }) => theme.color.rule};
  border-bottom: 1px solid ${({ theme }) => theme.color.rule};
  .v {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: clamp(1.2rem, 4.5vw, 1.55rem);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .v em {
    font-style: normal;
    color: ${({ theme }) => theme.color.muted};
    font-size: 0.85rem;
  }
  .k {
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    margin-top: 5px;
  }
`
const List = styled.div`
  margin-top: 16px;
  .pl {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px dashed ${({ theme }) => theme.color.ruleSoft};
  }
  .pl:last-child {
    border-bottom: 0;
  }
  .r {
    font-family: ${({ theme }) => theme.font.serif};
    font-weight: 600;
    min-width: 78px;
    line-height: 1.5;
  }
  .t {
    color: ${({ theme }) => theme.color.muted};
    font-size: 0.85rem;
    line-height: 1.5;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`
const CoverageTitle = styled.div`
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.muted};
  margin-bottom: 14px;
`
const Coverage = styled.div`
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 5px;
`
const Cell = styled.div<{ $filled: boolean }>`
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  border: 1px solid ${({ $filled, theme }) => ($filled ? theme.color.gold : theme.color.rule)};
  ${({ $filled, theme }) => ($filled ? `box-shadow: ${theme.shadow.glow};` : '')}
`
const Note = styled.p`
  color: ${({ theme }) => theme.color.muted};
`
const Heading = styled.div`
  margin-bottom: 26px;
  .eyebrow {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
  }
`

/** The profile screen heading (a small eyebrow + serif title), shared by
 * `/adopter/[pubkey]` and `/me` so the two never drift. */
export function ProfileHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Heading>
      <p className="eyebrow">{eyebrow}</p>
      <Serif style={{ fontSize: '1.6rem', fontWeight: 600 }}>{title}</Serif>
    </Heading>
  )
}

/**
 * One wallet's profile body — metrics, the verses it registered (paginated) and
 * its coverage grid over the 66 books. Shared by `/adopter/[pubkey]` (any wallet)
 * and `/me` (the connected wallet); the page owns the section heading. The SOL
 * figure uses adaptive precision so a small per-wallet contribution never shows
 * as ◎0 (rent is ~0.002 SOL/verse).
 */
export function AdopterProfile({ pubkey }: { pubkey: string }) {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const f = useFormatter()
  const labels = useBookLabels()
  const [page, setPage] = useState(1)
  const { data, isPending, isError } = useAdopter(pubkey, page)

  // A different wallet (navigating between adopters, or switching account on
  // /me) starts back at page 1 — otherwise a stale page can land past the new
  // wallet's last page and show an empty list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging when the pubkey changes
  useEffect(() => setPage(1), [pubkey])

  const pages = data ? Math.max(1, Math.ceil(data.page.total / data.page.pageSize)) : 1

  if (isPending) {
    return <Note>{tc('loading')}</Note>
  }
  if (isError || data === undefined) {
    return <Note>{tc('error')}</Note>
  }

  return (
    <Profile>
      <Panel>
        <Top>
          <div className="avatar" aria-hidden="true" />
          <div className="who">{shortenAddress(pubkey)}</div>
        </Top>
        <Metrics>
          <div>
            <div className="v">{f.number(data.verses)}</div>
            <div className="k">{t('verses')}</div>
          </div>
          <div>
            <div className="v">
              ◎
              {f.number(data.estimatedSol, {
                maximumFractionDigits: solFractionDigits(data.estimatedSol),
              })}{' '}
              <em>SOL</em>
            </div>
            <div className="k">{t('contributed')}</div>
          </div>
          <div>
            <div className="v">{f.number(data.books)}</div>
            <div className="k">{t('books')}</div>
          </div>
        </Metrics>

        {data.verses === 0 ? (
          <Note style={{ marginTop: 16 }}>{t('empty')}</Note>
        ) : (
          <>
            <List>
              {data.page.items.map((item) => (
                <div className="pl" key={`${item.book}:${item.chapter}:${item.verse}`}>
                  <span className="r">
                    {labels.abbrReference(item.book, item.chapter, item.verse)}
                  </span>
                  <span className="t">{item.text}</span>
                  <VerseStateChip status={item.status} compact />
                </div>
              ))}
            </List>
            <Pager page={page} pages={pages} onChange={setPage} />
          </>
        )}
      </Panel>

      <Panel>
        <CoverageTitle>
          {t('coverageTitle', { registered: data.verses, total: REGISTRABLE_VERSE_COUNT })}
        </CoverageTitle>
        <Coverage>
          {data.coverage.map((c) => {
            const filled = c.registered > 0
            const ratio = c.registrable > 0 ? c.registered / c.registrable : 0
            // Floor covered books so even a single registered verse reads clearly
            // gold against the empty ones — the grid is about *what* you've
            // touched, not fine gradients.
            const shown = filled ? Math.max(0.45, ratio) : 0
            return (
              <Cell
                key={c.book}
                $filled={filled}
                title={`${labels.name(c.book)} · ${c.registered}/${c.registrable}`}
                style={{ background: heatBackground(shown) }}
              />
            )
          })}
        </Coverage>
        <Note style={{ marginTop: 16, fontSize: '0.8rem' }}>{t('coverageNote')}</Note>
      </Panel>
    </Profile>
  )
}
