'use client'

import { RegisterButton } from '@/components/register-button'
import { Card } from '@/components/ui'
import { VerseStatus } from '@/components/verse-status'
import { useOmittedNote } from '@/hooks/use-books'
import { useVerseStatus } from '@/hooks/use-verse-status'
import type { VerseReference } from '@/lib/api'
import { omittedAt } from '@/lib/books'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Panel = styled(Card)`
  display: grid;
  gap: 0.9rem;
  justify-items: center;
  text-align: center;
  width: 100%;
  max-width: 40rem;
`
const Text = styled.blockquote`
  margin: 0;
  font-family: ${({ theme }) => theme.font.serif};
  font-size: 1.28rem;
  line-height: 1.5;
`
const OmittedNote = styled.div`
  display: grid;
  gap: 8px;
  justify-items: center;
  .badge {
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    border: 1px solid ${({ theme }) => theme.color.rule};
    border-radius: ${({ theme }) => theme.radius.pill};
    padding: 2px 10px;
  }
  p {
    margin: 0;
    font-size: 0.9rem;
    color: ${({ theme }) => theme.color.muted};
    max-width: 46ch;
  }
`

/**
 * The registration panel for one reference: the verse text, its live status,
 * and the right action. An omitted position (no text in the WEB) shows the
 * EX-01 explanatory note — absent variant, or the pointer for Romans 16:25 —
 * instead of a register button; only an AVAILABLE verse can be registered.
 * After a submit, `watching` keeps the status polling through to REGISTERED.
 */
export function RegisterPanel({ reference }: { reference: VerseReference }) {
  const t = useTranslations('panel')
  const omittedNote = useOmittedNote()
  const [watching, setWatching] = useState(false)
  const { data, isPending, isError } = useVerseStatus(reference, watching)

  const omitted = omittedAt(reference.book, reference.chapter, reference.verse)
  const isOmitted = data !== undefined && !data.registrable

  return (
    <Panel forwardedAs="section">
      {data?.text != null && <Text>“{data.text}”</Text>}

      {isOmitted ? (
        <OmittedNote>
          {omitted !== undefined ? (
            (() => {
              const note = omittedNote(omitted)
              return (
                <>
                  <span className="badge">{note.label}</span>
                  <p>{note.note}</p>
                </>
              )
            })()
          ) : (
            <p>{t('omitted')}</p>
          )}
        </OmittedNote>
      ) : (
        <>
          <VerseStatus data={data} isPending={isPending} isError={isError} />
          {data?.registrable === true && data.status === 'AVAILABLE' && (
            <RegisterButton
              book={reference.book}
              chapter={reference.chapter}
              verse={reference.verse}
              onSubmitted={() => setWatching(true)}
            />
          )}
        </>
      )}
    </Panel>
  )
}
