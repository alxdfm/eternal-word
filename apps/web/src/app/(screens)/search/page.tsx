'use client'

import { Button, Card, Section, SectionHead, SegmentedControl, Serif, Wrap } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useSearch } from '@/hooks/queries'
import { useBookLabels, useOmittedNote } from '@/hooks/use-books'
import { fetchVerse } from '@/lib/api'
import { BOOK_NUMBERS, omittedAt } from '@/lib/books'
import { useQuery } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
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
  gap: 8px;
  align-items: end;
  flex-wrap: wrap;
  margin: 16px 0;
`
const Field = styled.label`
  display: grid;
  gap: 4px;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.color.muted};
  select,
  input {
    padding: 0.45rem 0.5rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.color.rule};
    background: ${({ theme }) => theme.color.panel};
    color: ${({ theme }) => theme.color.text};
    font: inherit;
  }
  input {
    width: 5rem;
  }
`
const Gap = styled(Card)`
  margin-top: 16px;
  .head {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 6px;
  }
  .badge {
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    border: 1px solid ${({ theme }) => theme.color.rule};
    border-radius: ${({ theme }) => theme.radius.pill};
    padding: 2px 8px;
  }
  .verse {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: 1.2rem;
    line-height: 1.5;
    margin: 6px 0 0;
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.color.muted};
  }
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
  const f = useFormatter()
  const [input, setInput] = useState('light')
  const query = useDebounced(input, 250)
  const { data } = useSearch(query)

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
          placeholder={t('placeholder')}
          aria-label={t('eyebrow')}
          autoComplete="off"
          spellCheck={false}
        />
        {data && <span className="count">{t('count', { total: data.hits.length })}</span>}
      </Bar>
      {data && data.hits.length === 0 && query.trim() !== '' ? (
        <Note>{t('noResults', { query })}</Note>
      ) : data ? (
        <Results>
          {data.hits.map((hit) => (
            <ResultRow key={`${hit.book}:${hit.chapter}:${hit.verse}`}>
              <span className="ref">{labels.abbrReference(hit.book, hit.chapter, hit.verse)}</span>
              <span className="snip">
                <Highlight text={hit.text} query={query} />
              </span>
              <VerseStateChip status={hit.status} compact />
            </ResultRow>
          ))}
        </Results>
      ) : null}
    </>
  )
}

function ByReference() {
  const t = useTranslations('searchScreen')
  const labels = useBookLabels()
  const omittedNote = useOmittedNote()
  const [book, setBook] = useState(43)
  const [chapter, setChapter] = useState('3')
  const [verse, setVerse] = useState('16')
  const [ref, setRef] = useState<{ book: number; chapter: number; verse: number } | null>(null)

  const omitted = ref ? omittedAt(ref.book, ref.chapter, ref.verse) : undefined
  const { data, isError } = useQuery({
    queryKey: ['verse', ref?.book, ref?.chapter, ref?.verse],
    queryFn: () => fetchVerse(ref?.book as number, ref?.chapter as number, ref?.verse as number),
    enabled: ref !== null && omitted === undefined,
    retry: false,
  })

  const resolve = () => {
    const c = Number(chapter)
    const v = Number(verse)
    if (Number.isInteger(c) && c > 0 && Number.isInteger(v) && v > 0) {
      setRef({ book, chapter: c, verse: v })
    }
  }

  return (
    <>
      <RefForm>
        <Field>
          {t('byReference')}
          <select value={book} onChange={(e) => setBook(Number(e.target.value))}>
            {BOOK_NUMBERS.map((n) => (
              <option key={n} value={n}>
                {labels.name(n)}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          &nbsp;
          <input
            type="number"
            min={1}
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
          />
        </Field>
        <Field>
          &nbsp;
          <input type="number" min={1} value={verse} onChange={(e) => setVerse(e.target.value)} />
        </Field>
        <Button type="button" $variant="gold" onClick={resolve}>
          {t('resolve')}
        </Button>
      </RefForm>

      {ref !== null && omitted !== undefined ? (
        <Gap>
          {(() => {
            const note = omittedNote(omitted)
            return (
              <>
                <div className="head">
                  <Serif style={{ fontWeight: 600 }}>
                    {labels.reference(ref.book, ref.chapter, ref.verse)}
                  </Serif>
                  <span className="badge">{note.label}</span>
                </div>
                <p>{note.note}</p>
              </>
            )
          })()}
        </Gap>
      ) : ref !== null && isError ? (
        <Note>{t('notInCanon')}</Note>
      ) : ref !== null && data ? (
        <Gap>
          <div className="head">
            <Serif style={{ fontWeight: 600 }}>
              {labels.reference(ref.book, ref.chapter, ref.verse)}
            </Serif>
            <VerseStateChip status={data.status} compact />
          </div>
          {data.text !== null && <p className="verse">{data.text}</p>}
        </Gap>
      ) : null}
    </>
  )
}

export default function SearchPage() {
  const t = useTranslations('searchScreen')
  const [mode, setMode] = useState<'text' | 'ref'>('text')
  return (
    <Section>
      <Wrap>
        <SectionHead
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          index={t('index')}
        />
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
