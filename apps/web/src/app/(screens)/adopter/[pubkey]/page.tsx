'use client'

import { AdopterProfile, ProfileHeading } from '@/components/adopter-profile'
import { Section, Wrap } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

export default function AdopterPage() {
  const params = useParams<{ pubkey: string }>()
  const t = useTranslations('profile')

  return (
    <Section>
      <Wrap>
        <ProfileHeading eyebrow={t('eyebrow')} title={t('title')} />
        <AdopterProfile pubkey={params.pubkey} />
      </Wrap>
    </Section>
  )
}
