'use client'

import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'
import { ThemeProvider } from 'styled-components'
import { GlobalStyle } from './global-style'
import { theme } from './theme'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'ew-theme'

/**
 * Runs before paint (inlined in <head>): if the visitor has an explicit choice,
 * stamp it on <html> so there is no flash. With no choice, we leave `data-theme`
 * unset and `prefers-color-scheme` governs — the app follows the OS until the
 * visitor toggles. Kept dependency-free so it can be a raw inline script.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');if(p==='light'||p==='dark'){document.documentElement.dataset.theme=p}}catch(e){}})()`

interface ThemeContextValue {
  /** Effective theme, or null until mounted (avoids a hydration mismatch). */
  readonly mode: ThemeMode | null
  readonly toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemTheme(): ThemeMode {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme:dark)').matches
    ? 'dark'
    : 'light'
}

function storedTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/**
 * Mounts the styled-components theme + global tokens and owns the light/dark
 * toggle. The visual swap is a single `data-theme` attribute on <html>, so
 * toggling never re-renders the tree — React only tracks `mode` for the label.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode | null>(null)

  useEffect(() => {
    const stored = storedTheme()
    setMode(stored ?? systemTheme())
    if (stored !== null) {
      return
    }
    // No explicit choice yet: keep following the OS (label + CSS both).
    const media = window.matchMedia('(prefers-color-scheme:dark)')
    const onChange = () => setMode(storedTheme() ?? systemTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode / storage disabled — the attribute below still applies it.
    }
    document.documentElement.dataset.theme = next
    setMode(next)
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>
    </ThemeProvider>
  )
}

export function useThemeMode(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (value === null) {
    throw new Error('useThemeMode must be used within AppThemeProvider')
  }
  return value
}
