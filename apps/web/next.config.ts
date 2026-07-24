import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @eternal-word/blockchain ships source TS with NodeNext-style `.js`
  // specifiers; transpile it and map `.js` → `.ts` so the browser bundle
  // resolves it. Only the browser-safe `/register` subpath is imported (no
  // node:crypto / fs from the catalog).
  transpilePackages: ['@eternal-word/blockchain'],
  compiler: {
    // SSR + nomes de classe consistentes para styled-components (transform SWC,
    // sem plugin babel). O registry em src/lib/registry.tsx injeta as regras no
    // App Router via useServerInsertedHTML.
    styledComponents: true,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    }
    return config
  },
}

export default withNextIntl(nextConfig)
