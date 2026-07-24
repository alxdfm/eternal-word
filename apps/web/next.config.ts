import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compiler: {
    // SSR + nomes de classe consistentes para styled-components (transform SWC,
    // sem plugin babel). O registry em src/lib/registry.tsx injeta as regras no
    // App Router via useServerInsertedHTML.
    styledComponents: true,
  },
}

export default withNextIntl(nextConfig)
