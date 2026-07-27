// Constantes puras de locale, sem imports server-only (`next/headers`), para
// poderem ser importadas tanto pelo request config (server) quanto pelo toggle
// (client) sem arrastar `next/headers` para o bundle do cliente.
export const LOCALES = ['en', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: string | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value)
}

// Casa a locale pela 1ª preferência conhecida do Accept-Language (prefixo de
// idioma: `pt-*` → pt-BR). Não é negociação completa por q-value — suficiente e
// previsível para duas locales.
export function localeFromAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase()
    if (!tag) continue
    if (tag.startsWith('pt')) return 'pt-BR'
    if (tag.startsWith('en')) return 'en'
  }
  return undefined
}
