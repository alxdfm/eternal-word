import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compiler: {
    // SSR + nomes de classe consistentes para styled-components (transform SWC,
    // sem plugin babel). O registry em src/lib/registry.tsx injeta as regras no
    // App Router via useServerInsertedHTML.
    styledComponents: true,
  },
}

export default nextConfig
