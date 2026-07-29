import '@solana/wallet-adapter-react-ui/styles.css'

import { Providers } from '@/app/providers'
import { AppFooter } from '@/components/app-footer'
import { AppHeader } from '@/components/app-header'
import { LocaleNote } from '@/components/locale-note'
import { StyledComponentsRegistry } from '@/lib/registry'
import { AppThemeProvider, NO_FLASH_SCRIPT } from '@/theme'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale}>
      <body>
        {/* Applies the saved theme before the content paints — no flash of the
            wrong theme. Runs synchronously as the first node in <body>. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <StyledComponentsRegistry>
            <AppThemeProvider>
              <Providers>
                <AppHeader />
                <LocaleNote />
                {children}
                <AppFooter />
              </Providers>
            </AppThemeProvider>
          </StyledComponentsRegistry>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
