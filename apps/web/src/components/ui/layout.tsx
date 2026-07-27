'use client'

import type { ReactNode } from 'react'
import styled from 'styled-components'
import { Eyebrow, Lead, SectionHeading } from './typography'

/** Centered content column — the codex page width. */
export const Wrap = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
`

export const Section = styled.section`
  padding: ${({ theme }) => theme.space.section} 0;
  @media (max-width: 560px) {
    padding: 2.75rem 0;
  }
`

const Head = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 26px;
  @media (max-width: 560px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
`

/**
 * The eyebrow → heading → lead cluster every section opens with, plus an
 * optional slot on the right (e.g. a legend). Keeps the screens visually in step.
 */
export function SectionHead({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
}) {
  return (
    <Head>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionHeading>{title}</SectionHeading>
        {lead !== undefined && <Lead>{lead}</Lead>}
      </div>
      {children}
    </Head>
  )
}
