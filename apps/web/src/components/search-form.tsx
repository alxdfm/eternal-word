'use client'

import { useBookLabels } from '@/hooks/use-books'
import type { VerseReference } from '@/lib/api'
import { BOOK_NUMBERS } from '@/lib/books'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import styled from 'styled-components'

const Form = styled.form`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: end;
  justify-content: center;
`

const Field = styled.label`
  display: grid;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.color.muted};
  text-align: left;
`

const controlStyles = `
  padding: 0.45rem 0.5rem;
  border-radius: 0.5rem;
`

const Select = styled.select`
  ${controlStyles}
  min-width: 11rem;
  border: 1px solid ${({ theme }) => theme.color.rule};
  background: ${({ theme }) => theme.color.panel};
  color: ${({ theme }) => theme.color.text};
  font: inherit;
`

const Input = styled.input`
  ${controlStyles}
  width: 5.5rem;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.color.rule};
  background: ${({ theme }) => theme.color.panel};
  color: ${({ theme }) => theme.color.text};
`

const Submit = styled.button`
  ${controlStyles}
  padding: 0.5rem 1rem;
  border: 1px solid ${({ theme }) => theme.color.gold};
  background: ${({ theme }) => theme.color.gold};
  color: ${({ theme }) => theme.color.goldOn};
  box-shadow: ${({ theme }) => theme.shadow.glow};
  font-weight: 600;
  cursor: pointer;
`

/** Search a verse by reference. Book is chosen by **name** (never a bare 1-66),
 * paying down the S04 "book by number" debt; chapter and verse stay numeric. */
export function SearchForm({ onSearch }: { onSearch: (reference: VerseReference) => void }) {
  const t = useTranslations('search')
  const labels = useBookLabels()
  const [book, setBook] = useState('1')
  const [chapter, setChapter] = useState('1')
  const [verse, setVerse] = useState('1')

  function onSubmit(event: FormEvent): void {
    event.preventDefault()
    const parsed = [Number(book), Number(chapter), Number(verse)]
    if (parsed.every((value) => Number.isInteger(value) && value > 0)) {
      onSearch({
        book: parsed[0] as number,
        chapter: parsed[1] as number,
        verse: parsed[2] as number,
      })
    }
  }

  return (
    <Form onSubmit={onSubmit}>
      <Field>
        {t('book')}
        <Select value={book} onChange={(event) => setBook(event.target.value)}>
          {BOOK_NUMBERS.map((n) => (
            <option key={n} value={n}>
              {labels.name(n)}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        {t('chapter')}
        <Input
          type="number"
          min={1}
          value={chapter}
          onChange={(event) => setChapter(event.target.value)}
        />
      </Field>
      <Field>
        {t('verse')}
        <Input
          type="number"
          min={1}
          value={verse}
          onChange={(event) => setVerse(event.target.value)}
        />
      </Field>
      <Submit type="submit">{t('submit')}</Submit>
    </Form>
  )
}
