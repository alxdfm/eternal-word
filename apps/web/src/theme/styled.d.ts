import type { AppTheme } from './theme'

// Makes `theme` in styled-components callbacks fully typed (theme.color.gold, …)
// across the app — no per-file generics, no `any`.
declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}
