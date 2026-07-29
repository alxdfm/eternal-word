'use client'

import { Serif } from '@/components/ui'
import { VerseStateChip } from '@/components/verse-state-chip'
import { useBookLabels } from '@/hooks/use-books'
import type { VerseListItem } from '@/lib/api'
import { shortenAddress } from '@/lib/format'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import styled from 'styled-components'

const Row = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: start;
  padding: 13px 18px;
  border-bottom: 1px solid ${({ theme }) => theme.color.ruleSoft};
  &:last-child {
    border-bottom: 0;
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr auto;
    row-gap: 6px;
    .snip {
      grid-column: 1 / -1;
    }
  }
`
const Ref = styled(Serif)`
  font-weight: 600;
  font-size: 0.98rem;
  white-space: nowrap;
  /* keep the reference aligned with the first line of the (now wrapping) text */
  line-height: 1.5;
`
const Snippet = styled.span`
  color: ${({ theme }) => theme.color.muted};
  font-size: 0.86rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
`
const Right = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
`
const Who = styled(Link)`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.74rem;
  color: ${({ theme }) => theme.color.faint};
`
const Adopt = styled(Link)`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${({ theme }) => theme.color.lapis};
  white-space: nowrap;
`

/** One verse in a feed: reference (book name, EX-01) + snippet + state chip and,
 * for a registered verse, a link to its adopter — or "Adopt →" to that verse's
 * chapter view (UX-10), where it can be registered on its own or in a batch. */
export function VerseRow({ item }: { item: VerseListItem }) {
  const labels = useBookLabels()
  const t = useTranslations('explore')
  return (
    <Row>
      <Ref>{labels.abbrReference(item.book, item.chapter, item.verse)}</Ref>
      <Snippet className="snip">{item.text}</Snippet>
      <Right>
        <VerseStateChip status={item.status} compact />
        {item.status === 'REGISTERED' && item.adopter !== null ? (
          <Who href={`/adopter/${item.adopter}`}>{shortenAddress(item.adopter)}</Who>
        ) : item.status === 'AVAILABLE' ? (
          <Adopt href={`/chapter/${item.book}/${item.chapter}`}>{t('adopt')}</Adopt>
        ) : null}
      </Right>
    </Row>
  )
}
