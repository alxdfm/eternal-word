'use client'

import styled, { css } from 'styled-components'

type Variant = 'gold' | 'ghost'

/**
 * Two intents only. `gold` is the illuminated call to action (spent sparingly —
 * gold means the act of registering); `ghost` is the quiet, pill-shaped default
 * used for toggles and secondary actions.
 */
export const Button = styled.button<{ $variant?: Variant }>`
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radius.pill};
  padding: 7px 15px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: border-color 0.12s ease, color 0.12s ease;

  ${({ $variant = 'ghost', theme }) =>
    $variant === 'gold'
      ? css`
          color: ${theme.color.goldOn};
          background: ${theme.color.gold};
          border: 1px solid ${theme.color.gold};
          box-shadow: ${theme.shadow.glow};
        `
      : css`
          color: ${theme.color.muted};
          background: transparent;
          border: 1px solid ${theme.color.rule};
          &:hover {
            border-color: ${theme.color.lapisSoft};
            color: ${theme.color.text};
          }
        `}

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`
