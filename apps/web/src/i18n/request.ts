import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  isLocale,
  localeFromAcceptLanguage,
} from './config'

// English-first, com pt-BR como 2ª locale (S06/HD-07). Sem roteamento por locale
// (nenhum segmento [locale] no path) — a locale é resolvida por COOKIE
// (`NEXT_LOCALE`, gravado pelo toggle do header) com fallback no cabeçalho
// `Accept-Language`; `en` é o default. Ver ADR 2026-07-27_locale-pt-br.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale: Locale = isLocale(cookieLocale)
    ? cookieLocale
    : (localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE)

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
