'use client'

import { type ChipState, StateChip } from '@/components/ui'
import { useTranslations } from 'next-intl'

const CHIP_STATE: Record<string, ChipState | undefined> = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  REGISTERED: 'registered',
}

/**
 * Maps a mirror status DTO string onto the design-system {@link StateChip}.
 * FAILED and unknown statuses render nothing (they never surface in listings).
 * `compact` drops the label for dense rows.
 */
export function VerseStateChip({
  status,
  compact = false,
}: {
  status: string | null
  compact?: boolean
}) {
  const t = useTranslations('verseState')
  const state = status === null ? undefined : CHIP_STATE[status]
  if (state === undefined) {
    return null
  }
  return <StateChip state={state}>{compact ? undefined : t(state)}</StateChip>
}
