'use client'

import styled from 'styled-components'

const Track = styled.div`
  height: 8px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.color.cell0};
  overflow: hidden;
  box-shadow: inset 0 0 0 1px ${({ theme }) => theme.color.rule};
`

const Fill = styled.i<{ $ratio: number }>`
  display: block;
  height: 100%;
  width: ${({ $ratio }) => `${Math.max(0, Math.min(1, $ratio)) * 100}%`};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: linear-gradient(90deg, ${({ theme }) => theme.color.gold}, ${({ theme }) => theme.color.goldLit});
  box-shadow: ${({ theme }) => theme.shadow.glow};
`

/** Gilded progress bar — the canon filling. `ratio` is 0..1. */
export function Meter({ ratio, label }: { ratio: number; label?: string }) {
  return (
    <Track
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.max(0, Math.min(1, ratio)) * 100)}
      aria-label={label}
    >
      <Fill $ratio={ratio} aria-hidden="true" />
    </Track>
  )
}
