import { getRequestConfig } from 'next-intl/server'

// English-first com uma única locale (`en`). Sem roteamento por locale
// ([locale] no path) enquanto há um idioma só — as URLs ficam limpas (`/`, não
// `/en`). pt-BR entra na S06 (HD): quando entrar, este request config passa a
// resolver a locale por cookie/header. Ver ADR 2026-07-24_i18n-com-next-intl.
export default getRequestConfig(async () => {
  const locale = 'en'
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
