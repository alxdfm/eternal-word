'use client'

import { Wrap } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

/**
 * Optional donation address (a personal wallet, meant to be public). Empty →
 * the donation line is hidden. Paste the real Solana address here to show it;
 * donations are voluntary and support hosting/development, never a fee for
 * registering (which only ever pays the on-chain rent + the Solana network fee).
 */
const DONATION_ADDRESS: string = 'FMXr2m74Gd54B7pLQtQGK11fPCwd7nqJNu7GxM8AfAnV'

const Bar = styled.footer`
  border-top: 1px solid ${({ theme }) => theme.color.rule};
  margin-top: 72px;
  padding: 32px 0 48px;
  color: ${({ theme }) => theme.color.muted};
  font-size: 0.82rem;
  line-height: 1.65;
`
const Inner = styled.div`
  display: grid;
  gap: 8px;
  max-width: 64ch;
  p {
    margin: 0;
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
    font-family: ${({ theme }) => theme.font.serif};
    color: ${({ theme }) => theme.color.text};
    .glyph {
      color: ${({ theme }) => theme.color.gold};
    }
    b {
      font-weight: 600;
    }
  }
`
const Donate = styled.div`
  margin-top: 10px;
  display: grid;
  gap: 6px;
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .label {
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.faint};
  }
  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.78rem;
    color: ${({ theme }) => theme.color.text};
    word-break: break-all;
  }
  button {
    font: inherit;
    font-size: 0.72rem;
    color: ${({ theme }) => theme.color.lapis};
    background: transparent;
    border: 1px solid ${({ theme }) => theme.color.rule};
    border-radius: ${({ theme }) => theme.radius.pill};
    padding: 2px 10px;
    cursor: pointer;
    white-space: nowrap;
    &:hover {
      border-color: ${({ theme }) => theme.color.lapisSoft};
    }
  }
`

function DonateLine({ address }: { address: string }) {
  const t = useTranslations('footer')
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard blocked (no permission / insecure context) — the address is
      // shown in full anyway, so the user can still select and copy it.
    }
  }

  return (
    <Donate>
      <p>{t('donateIntro')}</p>
      <div className="row">
        <span className="label">{t('donateLabel')}</span>
        <code>{address}</code>
        <button type="button" onClick={copy}>
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </Donate>
  )
}

/** Global site footer (in the root layout, under every screen): the brand, the
 * non-profit statement, what the wallet actually pays for (only the on-chain
 * rent + the Solana network fee, no service fee), and an optional donation
 * address for hosting/development. */
export function AppFooter() {
  const t = useTranslations('footer')
  const brand = useTranslations('nav')('brand')
  return (
    <Bar>
      <Wrap>
        <Inner>
          <div className="brand">
            <span className="glyph" aria-hidden="true">
              ✦
            </span>
            <b>{brand}</b>
          </div>
          <p>{t('nonProfit')}</p>
          <p>{t('costs')}</p>
          {DONATION_ADDRESS !== '' && <DonateLine address={DONATION_ADDRESS} />}
        </Inner>
      </Wrap>
    </Bar>
  )
}
