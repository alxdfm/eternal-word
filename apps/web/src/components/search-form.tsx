'use client'

import type { VerseReference } from '@/lib/api'
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
  color: #6b7280;
`

const Input = styled.input`
  width: 5.5rem;
  padding: 0.4rem;
  text-align: center;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
`

const Submit = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  background: #111827;
  color: #fff;
  cursor: pointer;
`

/** Search a verse by numeric reference. Book names arrive with the exploration
 * screens (S05); here the reference is the (book, chapter, verse) triple. */
export function SearchForm({ onSearch }: { onSearch: (reference: VerseReference) => void }) {
  const t = useTranslations('search')
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
        <Input
          type="number"
          min={1}
          max={66}
          value={book}
          onChange={(event) => setBook(event.target.value)}
        />
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
