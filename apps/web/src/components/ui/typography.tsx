'use client'

import styled from 'styled-components'

/** Small uppercase kicker above a heading. */
export const Eyebrow = styled.p`
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.muted};
  font-weight: 600;
`

/** Old-style serif — scripture and numerals. */
export const Serif = styled.span`
  font-family: ${({ theme }) => theme.font.serif};
`

/** Monospace with tabular figures — on-chain data (slot, pubkey, ◎). */
export const Mono = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-variant-numeric: tabular-nums;
`

/** Tabular figures without changing the family — counters that must not jitter. */
export const Num = styled.span`
  font-variant-numeric: tabular-nums;
`

export const SectionHeading = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.font.serif};
  font-weight: 600;
  font-size: 1.6rem;
  line-height: 1.15;
  text-wrap: balance;
`

export const Lead = styled.p`
  margin: 0.4rem 0 0;
  color: ${({ theme }) => theme.color.muted};
  font-size: 0.95rem;
  max-width: 52ch;
`

/** Monospace section index, e.g. "§ 01 — System". Gold, quiet. */
export const SectionIndex = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.color.gold};
  white-space: nowrap;
`

export const Rule = styled.hr`
  height: 1px;
  border: 0;
  margin: 0;
  background: ${({ theme }) => theme.color.rule};
`
