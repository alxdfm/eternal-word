'use client'

import { AdopterProfile } from '@/components/adopter-profile'
import { Section, Serif, Wrap } from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

export default function AdopterPage() {
  const params = useParams<{ pubkey: string }>()
  const t = useTranslations('profile')

  return (
    <Section>
      <Wrap>
        <div style={{ marginBottom: 26 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {t('eyebrow')}
          </p>
          <Serif style={{ fontSize: '1.6rem', fontWeight: 600 }}>{t('title')}</Serif>
        </div>
        <AdopterProfile pubkey={params.pubkey} />
      </Wrap>
    </Section>
  )
}
