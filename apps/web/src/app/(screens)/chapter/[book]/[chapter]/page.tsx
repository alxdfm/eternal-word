'use client'

import { BulkRegisterButton } from '@/components/bulk-register-button'
import { Button, Pager, Section, SectionHead, Wrap } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useChapter } from '@/hooks/queries'
import { useBookLabels } from '@/hooks/use-books'
import {
  ChapterNotFoundError,
  type ChapterVerses,
  type VerseListItem,
  type VerseReference,
} from '@/lib/api'
import { BOOK_NUMBERS } from '@/lib/books'
import type { BulkRegisterOutcome } from '@/lib/bulk-register'
import { shortenAddress } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import styled from 'styled-components'

const CHAPTER_PAGE_SIZE = 20

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 4px 0 16px;
  padding: 12px 16px;
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.card};
  .count {
    font-size: 0.82rem;
    color: ${({ theme }) => theme.color.muted};
    font-variant-numeric: tabular-nums;
  }
  .spacer {
    flex: 1;
  }
`
const List = styled.div`
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.xl};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadow.card};
`
const Row = styled.label<{ $selectable: boolean }>`
  display: grid;
  grid-template-columns: 24px 68px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.color.ruleSoft};
  cursor: ${({ $selectable }) => ($selectable ? 'pointer' : 'default')};
  &:last-child {
    border-bottom: 0;
  }
  input {
    width: 17px;
    height: 17px;
    accent-color: ${({ theme }) => theme.color.gold};
    cursor: pointer;
  }
  .ref {
    font-family: ${({ theme }) => theme.font.serif};
    font-weight: 600;
    white-space: nowrap;
  }
  .snip {
    color: ${({ theme }) => theme.color.muted};
    font-size: 0.9rem;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.72rem;
    color: ${({ theme }) => theme.color.faint};
    white-space: nowrap;
  }
  @media (max-width: 560px) {
    grid-template-columns: 24px 1fr auto;
    row-gap: 4px;
    .snip {
      grid-column: 2 / -1;
    }
  }
`
const Note = styled.p`
  color: ${({ theme }) => theme.color.muted};
`

function isValidBook(book: number): boolean {
  return Number.isInteger(book) && (BOOK_NUMBERS as readonly number[]).includes(book)
}

export default function ChapterPage() {
  const params = useParams<{ book: string; chapter: string }>()
  const book = Number(params.book)
  const chapter = Number(params.chapter)
  const t = useTranslations('chapterScreen')
  const tc = useTranslations('common')
  const labels = useBookLabels()
  const queryClient = useQueryClient()

  const { data, isPending, isError, error } = useChapter(book, chapter)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [page, setPage] = useState(1)

  const available = useMemo(
    () => (data ? data.verses.filter((v) => v.status === 'AVAILABLE') : []),
    [data],
  )
  const registered = data ? data.verses.filter((v) => v.status === 'REGISTERED').length : 0
  const allAvailableSelected = available.length > 0 && available.every((v) => selected.has(v.verse))

  const title = isValidBook(book)
    ? labels.reference(book, chapter)
    : `${params.book}:${params.chapter}`

  function toggle(verse: number): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(verse)) {
        next.delete(verse)
      } else {
        next.add(verse)
      }
      return next
    })
  }
  function toggleAll(): void {
    setSelected(allAvailableSelected ? new Set() : new Set(available.map((v) => v.verse)))
  }

  const selectedReferences: readonly VerseReference[] = useMemo(
    () =>
      data
        ? data.verses
            .filter((v) => selected.has(v.verse))
            .map((v) => ({ book: v.book, chapter: v.chapter, verse: v.verse }))
        : [],
    [data, selected],
  )

  // After a bulk run, flip the verses that were sent to PENDING in the cache
  // (instant feedback) and clear the selection. The indexer promotes them to
  // REGISTERED; the web never writes that state.
  function onBulkComplete(outcome: BulkRegisterOutcome): void {
    const sent = new Set(outcome.succeeded.map((r) => r.verse))
    if (sent.size > 0) {
      queryClient.setQueryData<ChapterVerses>(['chapter', book, chapter], (old) =>
        old
          ? {
              ...old,
              verses: old.verses.map((v) => (sent.has(v.verse) ? { ...v, status: 'PENDING' } : v)),
            }
          : old,
      )
    }
    setSelected(new Set())
  }

  const pages = data ? Math.max(1, Math.ceil(data.verses.length / CHAPTER_PAGE_SIZE)) : 1
  const pageItems: readonly VerseListItem[] = data
    ? data.verses.slice((page - 1) * CHAPTER_PAGE_SIZE, page * CHAPTER_PAGE_SIZE)
    : []

  // A malformed URL (/chapter/foo/bar) or an out-of-range book is out of the
  // canon — a note, never a perpetual spinner (the query is disabled for it).
  const validParams = isValidBook(book) && Number.isInteger(chapter) && chapter >= 1
  const notInCanon = !validParams || error instanceof ChapterNotFoundError

  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={title} lead={t('lead')}>
          {data && (
            <span className="count" style={{ whiteSpace: 'nowrap', opacity: 0.85 }}>
              {t('progress', { registered, total: data.verses.length })}
            </span>
          )}
        </SectionHead>

        {notInCanon ? (
          <Note>{t('notInCanon')}</Note>
        ) : isPending ? (
          <Note>{tc('loading')}</Note>
        ) : isError || data === undefined ? (
          <Note>{tc('error')}</Note>
        ) : (
          <>
            <Bar>
              <Button
                type="button"
                onClick={toggleAll}
                disabled={available.length === 0}
                aria-pressed={allAvailableSelected}
              >
                {allAvailableSelected ? t('clear') : t('selectAll')}
              </Button>
              <span className="count">{t('selected', { count: selected.size })}</span>
              <span className="spacer" />
              {available.length === 0 ? (
                <span className="count">{t('noneAvailable')}</span>
              ) : (
                <BulkRegisterButton references={selectedReferences} onComplete={onBulkComplete} />
              )}
            </Bar>

            <List>
              {pageItems.map((item) => {
                const selectable = item.status === 'AVAILABLE'
                return (
                  <Row key={item.verse} $selectable={selectable}>
                    {selectable ? (
                      <input
                        type="checkbox"
                        checked={selected.has(item.verse)}
                        onChange={() => toggle(item.verse)}
                        aria-label={labels.reference(item.book, item.chapter, item.verse)}
                      />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className="ref">
                      {labels.abbrReference(item.book, item.chapter, item.verse)}
                    </span>
                    <span className="snip">{item.text}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {item.status === 'REGISTERED' && item.adopter !== null && (
                        <Link className="who" href={`/adopter/${item.adopter}`}>
                          {shortenAddress(item.adopter)}
                        </Link>
                      )}
                      <VerseStateChip status={item.status} compact />
                    </span>
                  </Row>
                )
              })}
            </List>

            <Pager page={page} pages={pages} onChange={setPage} />
          </>
        )}
      </Wrap>
    </Section>
  )
}
