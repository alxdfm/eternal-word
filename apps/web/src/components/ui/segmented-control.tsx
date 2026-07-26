'use client'

import styled from 'styled-components'

const Group = styled.div`
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: ${({ theme }) => theme.color.panel2};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.pill};
`

const Segment = styled.button<{ $active: boolean }>`
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  border: 0;
  padding: 6px 15px;
  border-radius: ${({ theme }) => theme.radius.pill};
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.color.goldOn : theme.color.muted)};
  background: ${({ $active, theme }) => ($active ? theme.color.gold : 'transparent')};
  box-shadow: ${({ $active, theme }) => ($active ? theme.shadow.glow : 'none')};
  &:hover {
    color: ${({ $active, theme }) => ($active ? theme.color.goldOn : theme.color.text)};
  }
`

export interface SegmentOption<T extends string> {
  readonly value: T
  readonly label: string
}

/**
 * Pill segmented control — the active segment is gilded (the one gold accent on
 * an interactive control). Used for the search modes and the explore filters.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <Group role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <Segment
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          $active={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Segment>
      ))}
    </Group>
  )
}
