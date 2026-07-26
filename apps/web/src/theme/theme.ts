/**
 * Semantic theme for styled-components. Every value points at a CSS custom
 * property defined in {@link GlobalStyle} — so components read `theme.color.gold`
 * and the light/dark swap happens in CSS (one `data-theme` on <html>), never in
 * React. Gold is the one accent, reserved for the Registered state.
 */
export const theme = {
  color: {
    bg: 'var(--bg)',
    panel: 'var(--panel)',
    panel2: 'var(--panel2)',
    rule: 'var(--rule)',
    ruleSoft: 'var(--rule-soft)',
    text: 'var(--text)',
    muted: 'var(--muted)',
    faint: 'var(--faint)',
    /** Illumination — reserved for `Registered`. */
    gold: 'var(--gold)',
    goldLit: 'var(--gold-lit)',
    goldOn: 'var(--gold-on)',
    goldRgb: 'var(--gold-rgb)',
    /** Structural sacred — links and action. */
    lapis: 'var(--lapis)',
    lapisSoft: 'var(--lapis-soft)',
    /** Candle — `Pending`, still being inscribed. */
    pending: 'var(--pending)',
    /** Base tint of an unfilled heatmap cell / meter track. */
    cell0: 'var(--cell0)',
    surface: 'var(--surface)',
  },
  font: {
    serif: 'var(--serif)',
    sans: 'var(--sans)',
    mono: 'var(--mono)',
  },
  shadow: {
    card: 'var(--shadow)',
    /** Gold bloom — only meaningful in dark; `none` in light. */
    glow: 'var(--glow)',
  },
  /** Spacing scale (rem). Named so intent survives a redesign. */
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '2.75rem',
    section: '3.75rem',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '11px',
    xl: '14px',
    '2xl': '16px',
    pill: '100px',
  },
  maxWidth: 'var(--wrap)',
} as const

export type AppTheme = typeof theme
