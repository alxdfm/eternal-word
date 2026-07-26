'use client'

import { Button, Section, SectionHead, Wrap } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import styled from 'styled-components'

const Form = styled.form`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  input {
    flex: 1;
    min-width: 16rem;
    font: inherit;
    padding: 0.55rem 0.75rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.color.rule};
    background: ${({ theme }) => theme.color.panel};
    color: ${({ theme }) => theme.color.text};
    font-family: ${({ theme }) => theme.font.mono};
  }
`

export default function AdopterIndexPage() {
  const t = useTranslations('profile')
  const router = useRouter()
  const [value, setValue] = useState('')

  function onSubmit(event: FormEvent): void {
    event.preventDefault()
    const pubkey = value.trim()
    if (pubkey !== '') {
      router.push(`/adopter/${encodeURIComponent(pubkey)}`)
    }
  }

  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={t('title')} lead={t('enterWallet')} />
        <Form onSubmit={onSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={t('walletLabel')}
            placeholder="GE94ozHz…1BhZ"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" $variant="gold">
            {t('eyebrow')}
          </Button>
        </Form>
      </Wrap>
    </Section>
  )
}
