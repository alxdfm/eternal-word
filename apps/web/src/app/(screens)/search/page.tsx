'use client'

import { RegisterPanel } from '@/components/register-panel'
import { Button, Pager, Section, SectionHead, SegmentedControl, Wrap } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useSearch } from '@/hooks/queries'
import { useBookLabels } from '@/hooks/use-books'
import { SEARCH_PAGE_SIZE, type VerseReference } from '@/lib/api'
import { REGISTRABLE_VERSE_COUNT } from '@/lib/books'
import { parseReference } from '@/lib/reference'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useState } from 'react'
import styled from 'styled-components'

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  padding: 2px 16px;
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.card};
  &:focus-within {
    border-color: ${({ theme }) => theme.color.lapisSoft};
  }
  input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 1.02rem;
    color: ${({ theme }) => theme.color.text};
    background: transparent;
    border: 0;
    padding: 13px 0;
    outline: none;
  }
  .icon {
    color: ${({ theme }) => theme.color.muted};
    font-size: 1.2rem;
  }
  .count {
    font-size: 0.76rem;
    color: ${({ theme }) => theme.color.muted};
    font-family: ${({ theme }) => theme.font.mono};
    white-space: nowrap;
  }
`
const Results = styled.div`
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.xl};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadow.card};
`
const ResultRow = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 13px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.color.ruleSoft};
  &:last-child {
    border-bottom: 0;
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
  }
`
const Mark = styled.mark`
  background: color-mix(in oklab, ${({ theme }) => theme.color.gold} 26%, transparent);
  color: ${({ theme }) => theme.color.text};
  border-radius: 3px;
  padding: 0 3px;
  font-weight: 600;
`
const RefForm = styled.div`
  display: flex;
  gap: 10px;
  align-items: stretch;
  flex-wrap: wrap;
  margin: 16px 0;
`
const PanelWrap = styled.div`
  margin-top: 16px;
  display: grid;
  justify-items: center;
`
const Note = styled.p`
  color: ${({ theme }) => theme.color.muted};
`

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)
  if (terms.length === 0) {
    return text
  }
  const termSet = new Set(terms.map((w) => w.toLowerCase()))
  const parts = text.split(new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig'))
  return parts.map((part, i) =>
    termSet.has(part.toLowerCase()) ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: split parts are positional
      <Mark key={i}>{part}</Mark>
    ) : (
      part
    ),
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function ByText() {
  const t = useTranslations('searchScreen')
  const labels = useBookLabels()
  const [input, setInput] = useState('light')
  const query = useDebounced(input, 250)
  const [page, setPage] = useState(1)
  const { data } = useSearch(query, page)

  // A new query starts back at page 1.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset paging on query change
  useEffect(() => setPage(1), [query])

  const pages = data ? Math.ceil(data.total / SEARCH_PAGE_SIZE) : 0

  return (
    <>
      <Bar>
        <span className="icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder', { count: REGISTRABLE_VERSE_COUNT })}
          aria-label={t('eyebrow')}
          autoComplete="off"
          spellCheck={false}
        />
        {data && <span className="count">{t('count', { total: data.total })}</span>}
      </Bar>
      {data && data.total === 0 && query.trim() !== '' ? (
        <Note>{t('noResults', { query })}</Note>
      ) : data ? (
        <>
          <Results>
            {data.hits.map((hit) => (
              <ResultRow key={`${hit.book}:${hit.chapter}:${hit.verse}`}>
                <span className="ref">
                  {labels.abbrReference(hit.book, hit.chapter, hit.verse)}
                </span>
                <span className="snip">
                  <Highlight text={hit.text} query={query} />
                </span>
                <VerseStateChip status={hit.status} compact />
              </ResultRow>
            ))}
          </Results>
          <Pager page={page} pages={pages} onChange={setPage} />
        </>
      ) : null}
    </>
  )
}

function ByReference() {
  const t = useTranslations('searchScreen')
  const labels = useBookLabels()
  const [input, setInput] = useState('John 3:16')
  const [ref, setRef] = useState<VerseReference | null>(null)
  const [invalid, setInvalid] = useState(false)

  // Paste a reference like "Isa 60:19" — parsed against the localized book
  // names/abbreviations, no more three separate fields (UX-07).
  const resolve = () => {
    const parsed = parseReference(input, (book) => [labels.name(book), labels.abbr(book)])
    if (parsed === null) {
      setInvalid(true)
      setRef(null)
      return
    }
    setInvalid(false)
    setRef(parsed)
  }

  return (
    <>
      <RefForm>
        <Bar style={{ flex: '1 1 16rem', margin: 0 }}>
          <span className="icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') resolve()
            }}
            placeholder={t('refPlaceholder')}
            aria-label={t('byReference')}
            autoComplete="off"
            spellCheck={false}
          />
        </Bar>
        <Button type="button" $variant="gold" onClick={resolve}>
          {t('resolve')}
        </Button>
      </RefForm>

      {invalid && <Note>{t('invalidReference')}</Note>}

      {/* The panel resolves the verse, shows its status + text, the omitted note
          (incl. the Rm 16:25 pointer), and — when AVAILABLE — the register CTA. */}
      {ref !== null && (
        <PanelWrap>
          <RegisterPanel key={`${ref.book}:${ref.chapter}:${ref.verse}`} reference={ref} />
        </PanelWrap>
      )}
    </>
  )
}

export default function SearchPage() {
  const t = useTranslations('searchScreen')
  const [mode, setMode] = useState<'text' | 'ref'>('text')
  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />
        <SegmentedControl
          ariaLabel={t('eyebrow')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'text', label: t('byText') },
            { value: 'ref', label: t('byReference') },
          ]}
        />
        {mode === 'text' ? <ByText /> : <ByReference />}
      </Wrap>
    </Section>
  )
}
