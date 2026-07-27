'use client'

import { Pager, Section, SectionHead, SegmentedControl, Wrap } from '@/components/ui'
import { VerseRow } from '@/components/verse-row'
import { useVerses } from '@/hooks/queries'
import type { ListFilter } from '@/lib/api'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const BrowseBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`
const Count = styled.span`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.color.muted};
  font-family: ${({ theme }) => theme.font.mono};
`
const Feed = styled.div`
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.xl};
  box-shadow: ${({ theme }) => theme.shadow.card};
  overflow: hidden;
`
const Note = styled.p`
  padding: 24px 18px;
  margin: 0;
  color: ${({ theme }) => theme.color.muted};
  text-align: center;
`

export default function ExplorePage() {
  const t = useTranslations('explore')
  const tc = useTranslations('common')
  const [filter, setFilter] = useState<ListFilter>('recent')
  const [page, setPage] = useState(1)
  const query = useVerses(filter, page)

  const onFilter = (next: ListFilter) => {
    setFilter(next)
    setPage(1)
  }

  const data = query.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
        <BrowseBar>
          <SegmentedControl
            ariaLabel={t('eyebrow')}
            value={filter}
            onChange={onFilter}
            options={[
              { value: 'recent', label: t('filterRecent') },
              { value: 'registered', label: t('filterRegistered') },
              { value: 'pending', label: t('filterPending') },
              { value: 'available', label: t('filterAvailable') },
            ]}
          />
          {data && <Count>{t('count', { total: data.total })}</Count>}
        </BrowseBar>

        <Feed>
          {query.isPending ? (
            <Note>{tc('loading')}</Note>
          ) : query.isError ? (
            <Note>{tc('error')}</Note>
          ) : data && data.items.length > 0 ? (
            data.items.map((item) => (
              <VerseRow key={`${item.book}:${item.chapter}:${item.verse}`} item={item} />
            ))
          ) : (
            <Note>{tc('empty')}</Note>
          )}
        </Feed>

        <Pager page={page} pages={pages} onChange={setPage} />
      </Wrap>
    </Section>
  )
}
