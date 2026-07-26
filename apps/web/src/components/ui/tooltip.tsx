'use client'

import type { ReactNode } from 'react'
import styled from 'styled-components'

const Anchor = styled.span<{ $stretch: boolean }>`
  position: relative;
  display: ${({ $stretch }) => ($stretch ? 'block' : 'inline-flex')};
  ${({ $stretch }) => $stretch && 'width: 100%; height: 100%;'}
`

const Bubble = styled.span`
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%) translateY(4px);
  z-index: 60;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s ease, transform 0.1s ease;

  background: ${({ theme }) => theme.color.surface};
  color: ${({ theme }) => theme.color.text};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: ${({ theme }) => theme.shadow.card};
  font-size: 0.8rem;
  width: max-content;
  max-width: 230px;
  text-align: left;

  ${Anchor}:hover &, ${Anchor}:focus-within & {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`

/**
 * Lightweight hover/focus tooltip — CSS-only reveal (no state), so a whole
 * mosaic of cells can each carry one without a render cost until hovered. The
 * bubble sits above the trigger and reads on keyboard focus too. Pass `stretch`
 * when the trigger must fill its parent (e.g. a grid cell), so the anchor does
 * not collapse to content width.
 */
export function Tooltip({
  content,
  children,
  stretch = false,
}: {
  content: ReactNode
  children: ReactNode
  stretch?: boolean
}) {
  return (
    <Anchor $stretch={stretch}>
      {children}
      <Bubble role="tooltip">{content}</Bubble>
    </Anchor>
  )
}
