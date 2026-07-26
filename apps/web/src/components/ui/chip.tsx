'use client'

import type { ReactNode } from 'react'
import styled, { keyframes } from 'styled-components'

/** The three states a chip can show. `available` and `pending` also carry a
 * distinct dot *shape*, so state is legible without relying on hue. */
export type ChipState = 'available' | 'pending' | 'registered'

const spin = keyframes`to { transform: rotate(360deg) }`

const Root = styled.span<{ $state: ChipState; $compact: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: ${({ $compact }) => ($compact ? '2px 8px' : '4px 11px 4px 9px')};
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 1px solid ${({ theme }) => theme.color.rule};
  white-space: nowrap;

  ${({ $state, theme }) =>
    $state === 'registered' &&
    `
      color: ${theme.color.gold};
      border-color: color-mix(in oklab, ${theme.color.gold} 45%, ${theme.color.rule});
      background: color-mix(in oklab, ${theme.color.gold} 12%, transparent);
    `}
  ${({ $state, theme }) =>
    $state === 'pending' &&
    `
      color: ${theme.color.pending};
      border-color: color-mix(in oklab, ${theme.color.pending} 40%, ${theme.color.rule});
    `}
  ${({ $state, theme }) => $state === 'available' && `color: ${theme.color.muted};`}

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: none;
  }
  &[data-state='registered'] .dot {
    background: ${({ theme }) => theme.color.gold};
    box-shadow: ${({ theme }) => theme.shadow.glow};
  }
  &[data-state='pending'] .dot {
    background: transparent;
    border: 1.5px dashed ${({ theme }) => theme.color.pending};
    animation: ${spin} 3.4s linear infinite;
  }
  &[data-state='available'] .dot {
    background: transparent;
    border: 1.5px solid ${({ theme }) => theme.color.faint};
  }
`

/**
 * State chip: `Available` / `Pending` / `Registered`, distinct by **form** (dot
 * shape) as well as color. Pass a label as children; omit it for the compact,
 * icon-only variant used in dense rows and stat tiles.
 */
export function StateChip({
  state,
  children,
}: {
  state: ChipState
  children?: ReactNode
}) {
  return (
    <Root $state={state} $compact={children === undefined} data-state={state}>
      <span className="dot" aria-hidden="true" />
      {children}
    </Root>
  )
}
