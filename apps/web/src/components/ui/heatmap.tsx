'use client'

import styled from 'styled-components'

/** Sequential single-hue ramp: an unfilled cell is `cell0`; as the ratio rises
 * it mixes toward gold. One tone only — never a rainbow — so the eye reads
 * "more gold = more registered". `ratio` is clamped to 0..1. */
export function heatBackground(ratio: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100)
  return `color-mix(in oklab, var(--gold) ${pct}%, var(--cell0))`
}

/** Past this fill, gold dominates the cell and text flips to `gold-on` for
 * contrast — the same threshold the mockup uses. */
export function isLit(ratio: number): boolean {
  return ratio >= 0.55
}

/** The reference/demo cell. Real screens (progress map) compose the helpers
 * above into their own grid, but this shows the ramp in the style guide. */
export const HeatCell = styled.div<{ $ratio: number }>`
  aspect-ratio: 1 / 1;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid ${({ theme }) => theme.color.rule};
  background: ${({ $ratio }) => heatBackground($ratio)};
`

/** The legend swatch — the full ramp, for a "0% … 40%+" scale caption. */
export const HeatRamp = styled.span`
  height: 10px;
  width: 170px;
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 1px solid ${({ theme }) => theme.color.rule};
  background: linear-gradient(
    90deg,
    var(--cell0),
    color-mix(in oklab, var(--gold) 45%, var(--cell0)),
    var(--gold)
  );
`
