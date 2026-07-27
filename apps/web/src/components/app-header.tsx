'use client'

import { LocaleToggle, ThemeToggle, Wrap } from '@/components/ui'
import { WalletButton } from '@/components/wallet-button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styled from 'styled-components'

const Bar = styled.header`
  border-bottom: 1px solid ${({ theme }) => theme.color.rule};
  background: color-mix(in oklab, ${({ theme }) => theme.color.bg} 82%, transparent);
  backdrop-filter: blur(6px);
  position: sticky;
  top: 0;
  z-index: 20;
`
const Inner = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  height: 60px;
  @media (max-width: 860px) {
    height: auto;
    min-height: 60px;
    flex-wrap: wrap;
    padding: 10px 0;
    row-gap: 10px;
  }
`
const Mark = styled(Link)`
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-family: ${({ theme }) => theme.font.serif};
  color: ${({ theme }) => theme.color.text};
  text-decoration: none;
  .glyph {
    color: ${({ theme }) => theme.color.gold};
  }
  b {
    font-weight: 600;
    font-size: 1.06rem;
  }
`
const Nav = styled.nav`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  @media (max-width: 860px) {
    order: 3;
    flex-basis: 100%;
  }
`
const NavLink = styled(Link)<{ $active: boolean }>`
  font-size: 0.85rem;
  font-weight: 600;
  padding: 6px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
  text-decoration: none;
  color: ${({ $active, theme }) => ($active ? theme.color.gold : theme.color.muted)};
  background: ${({ $active, theme }) =>
    $active ? `color-mix(in oklab, ${theme.color.gold} 12%, transparent)` : 'transparent'};
  &:hover {
    color: ${({ theme }) => theme.color.text};
  }
`
const Spacer = styled.div`
  flex: 1;
`
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const LINKS = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/explore', key: 'explore' },
  { href: '/map', key: 'map' },
  { href: '/search', key: 'search' },
] as const

/** The shared chrome for the exploration screens: brand, section nav (active
 * item gilded), theme toggle and wallet button. */
export function AppHeader() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const tTheme = useTranslations('theme')
  const tLocale = useTranslations('locale')
  return (
    <Bar>
      <Wrap>
        <Inner>
          <Mark href="/">
            <span className="glyph">✦</span>
            <b>{t('brand')}</b>
          </Mark>
          <Nav>
            {LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} $active={pathname.startsWith(link.href)}>
                {t(link.key)}
              </NavLink>
            ))}
          </Nav>
          <Spacer />
          <Actions>
            <LocaleToggle
              ariaLabel={tLocale('toggle')}
              labels={{ en: tLocale('en'), pt: tLocale('pt') }}
            />
            <ThemeToggle
              ariaLabel={tTheme('toggle')}
              darkLabel={tTheme('dark')}
              lightLabel={tTheme('light')}
            />
            <WalletButton />
          </Actions>
        </Inner>
      </Wrap>
    </Bar>
  )
}
