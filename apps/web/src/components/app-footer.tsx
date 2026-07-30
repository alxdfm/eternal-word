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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px 64px;
  flex-wrap: wrap;
  p {
    margin: 0;
  }
  .about {
    display: grid;
    gap: 8px;
    max-width: 52ch;
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
  display: grid;
  gap: 6px;
  min-width: min(100%, 300px);
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    white-space: nowrap;
    .sol {
      color: ${({ theme }) => theme.color.gold};
      font-size: 0.9rem;
    }
  }
  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.78rem;
    color: ${({ theme }) => theme.color.text};
    word-break: break-all;
  }
  .copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex: none;
    color: ${({ theme }) => theme.color.muted};
    background: transparent;
    border: 1px solid ${({ theme }) => theme.color.rule};
    border-radius: 8px;
    cursor: pointer;
    &:hover {
      color: ${({ theme }) => theme.color.lapis};
      border-color: ${({ theme }) => theme.color.lapisSoft};
    }
    svg {
      width: 14px;
      height: 14px;
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
        <span className="tag">
          <span className="sol" aria-hidden="true">
            ◎
          </span>
          {t('solanaAddress')}
        </span>
        <code>{address}</code>
        <button
          type="button"
          className="copy"
          onClick={copy}
          aria-label={t('copy')}
          title={copied ? t('copied') : t('copy')}
        >
          {copied ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
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
          <div className="about">
            <div className="brand">
              <span className="glyph" aria-hidden="true">
                ✦
              </span>
              <b>{brand}</b>
            </div>
            <p>{t('nonProfit')}</p>
            <p>{t('costs')}</p>
          </div>
          {DONATION_ADDRESS !== '' && <DonateLine address={DONATION_ADDRESS} />}
        </Inner>
      </Wrap>
    </Bar>
  )
}
