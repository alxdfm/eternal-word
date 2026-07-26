'use client'

import { Pager, Section, Serif, Wrap, heatBackground } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useAdopter } from '@/hooks/queries'
import { useBookLabels } from '@/hooks/use-books'
import { shortenAddress } from '@/lib/format'
import { useFormatter, useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import styled from 'styled-components'

const Profile = styled.div`
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 22px;
  align-items: stretch;
  @media (max-width: 920px) {
    grid-template-columns: 1fr;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 18px 0;
  border-top: 1px solid ${({ theme }) => theme.color.rule};
  border-bottom: 1px solid ${({ theme }) => theme.color.rule};
  .v {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: 1.55rem;
    font-variant-numeric: tabular-nums;
    line-height: 1;
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
    align-items: center;
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
  }
  .t {
    color: ${({ theme }) => theme.color.muted};
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
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
  grid-template-columns: repeat(11, 1fr);
  gap: 5px;
`
const Cell = styled.div`
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.color.rule};
`
const Note = styled.p`
  color: ${({ theme }) => theme.color.muted};
`

export default function AdopterPage() {
  const params = useParams<{ pubkey: string }>()
  const pubkey = params.pubkey
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const f = useFormatter()
  const labels = useBookLabels()
  const [page, setPage] = useState(1)
  const { data, isPending, isError } = useAdopter(pubkey, page)

  const pages = data ? Math.max(1, Math.ceil(data.page.total / data.page.pageSize)) : 1

  return (
    <Section>
      <Wrap>
        <div style={{ marginBottom: 26 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {t('eyebrow')}
          </p>
          <Serif style={{ fontSize: '1.6rem', fontWeight: 600 }}>{t('title')}</Serif>
        </div>

        {isPending ? (
          <Note>{tc('loading')}</Note>
        ) : isError || data === undefined ? (
          <Note>{tc('error')}</Note>
        ) : (
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
                    ◎{f.number(data.estimatedSol, { maximumFractionDigits: 2 })}
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
                {t('coverageTitle', { registered: data.verses, total: 31098 })}
              </CoverageTitle>
              <Coverage>
                {data.coverage.map((c) => (
                  <Cell
                    key={c.book}
                    title={labels.name(c.book)}
                    style={{
                      background: heatBackground(
                        c.registrable > 0 ? c.registered / c.registrable : 0,
                      ),
                    }}
                  />
                ))}
              </Coverage>
              <Note style={{ marginTop: 16, fontSize: '0.8rem' }}>{t('coverageNote')}</Note>
            </Panel>
          </Profile>
        )}
      </Wrap>
    </Section>
  )
}
