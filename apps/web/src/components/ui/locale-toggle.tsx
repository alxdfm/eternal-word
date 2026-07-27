'use client'

import { LOCALE_COOKIE } from '@/i18n/config'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from './button'

// Sem roteamento por locale (nenhum [locale] no path): a escolha vive no cookie
// `NEXT_LOCALE`, que o request config lê a cada request. Alternar = gravar o
// cookie e revalidar os Server Components (`router.refresh()`), que recarregam
// as mensagens e o formatador na nova locale. Ver ADR 2026-07-27_locale-pt-br.
const NEXT_LOCALE: Record<string, 'en' | 'pt-BR'> = { en: 'pt-BR', 'pt-BR': 'en' }
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Flips English ↔ pt-BR. The label shows the language it switches *to* (its
 * short code); the aria-label describes the action. Labels are passed in so i18n
 * stays at the call site, mirroring ThemeToggle.
 */
export function LocaleToggle({
  ariaLabel,
  labels,
}: {
  ariaLabel: string
  labels: { en: string; pt: string }
}) {
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const next = NEXT_LOCALE[locale] ?? 'pt-BR'
  const label = next === 'pt-BR' ? labels.pt : labels.en

  function switchLocale() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <Button
      type="button"
      $variant="ghost"
      onClick={switchLocale}
      aria-label={ariaLabel}
      disabled={pending}
    >
      <span aria-hidden="true">🌐</span>
      <span className="ew-toggle-label">{label}</span>
    </Button>
  )
}
