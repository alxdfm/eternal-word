'use client'

import { useThemeMode } from '@/theme'
import { Button } from './button'

/**
 * Flips light/dark. Labels are passed in (i18n stays at the call site). Until
 * mounted, `mode` is null and we render a neutral label so server and client
 * markup match — no hydration warning.
 */
export function ThemeToggle({
  ariaLabel,
  darkLabel,
  lightLabel,
}: {
  ariaLabel: string
  darkLabel: string
  lightLabel: string
}) {
  const { mode, toggle } = useThemeMode()
  // When mode is dark, the button offers to switch to light, and vice-versa.
  const label = mode === null ? '' : mode === 'dark' ? lightLabel : darkLabel
  const icon = mode === 'light' ? '☾' : '☀'

  return (
    <Button type="button" $variant="ghost" onClick={toggle} aria-label={ariaLabel}>
      <span aria-hidden="true">{icon}</span>
      {label !== '' && <span>{label}</span>}
    </Button>
  )
}
