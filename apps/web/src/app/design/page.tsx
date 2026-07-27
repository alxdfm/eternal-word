'use client'

import {
  Button,
  Card,
  Eyebrow,
  HeatRamp,
  Mono,
  Section,
  SectionHead,
  SegmentedControl,
  Serif,
  StateChip,
  Tooltip,
  Wrap,
} from '@/components/ui'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 20px;
  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`
const Swatches = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`
const Sw = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  .chipc {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    flex: none;
    border: 1px solid rgba(128, 128, 128, 0.25);
  }
  .nm {
    font-size: 0.86rem;
    font-weight: 600;
  }
  .ds {
    font-size: 0.76rem;
    color: ${({ theme }) => theme.color.muted};
  }
`
const TypeRow = styled.div`
  padding: 9px 0;
  border-bottom: 1px dashed ${({ theme }) => theme.color.ruleSoft};
  &:last-child {
    border-bottom: 0;
  }
  .lbl {
    font-size: 0.66rem;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.faint};
    margin-bottom: 3px;
  }
`
const States = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  .st {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .st small {
    color: ${({ theme }) => theme.color.muted};
    font-size: 0.76rem;
    text-align: right;
    max-width: 22ch;
  }
  .note {
    font-size: 0.78rem;
    color: ${({ theme }) => theme.color.muted};
    margin: 16px 0 0;
    border-top: 1px dashed ${({ theme }) => theme.color.ruleSoft};
    padding-top: 12px;
  }
`
const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  &:last-child {
    margin-bottom: 0;
  }
`
const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.76rem;
  color: ${({ theme }) => theme.color.muted};
`
const DemoCell = styled.button`
  width: 96px;
  min-height: 58px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.color.rule};
  background: ${({ theme }) => theme.color.cell0};
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  cursor: pointer;
`

/**
 * Style-guide route (§01 of the mockup) — renders the tokens and primitives so a
 * change to the design system is visible in one place. This is the bridge that
 * keeps production from drifting from the approved "Códice de Luz" mockup.
 */
export default function DesignPage() {
  const t = useTranslations('design')
  const tState = useTranslations('verseState')
  const [mode, setMode] = useState<'text' | 'ref'>('text')

  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={<Serif>{t('title')}</Serif>} lead={t('lead')} />

        <Grid>
          <Card>
            <Eyebrow as="span">{t('palette.title')}</Eyebrow>
            <Swatches style={{ marginTop: '14px' }}>
              <Sw>
                <span className="chipc" style={{ background: 'var(--bg)' }} />
                <div>
                  <div className="nm">{t('palette.ground')}</div>
                  <div className="ds">{t('palette.groundDesc')}</div>
                </div>
              </Sw>
              <Sw>
                <span
                  className="chipc"
                  style={{ background: 'var(--gold)', boxShadow: 'var(--glow)' }}
                />
                <div>
                  <div className="nm">{t('palette.gold')}</div>
                  <div className="ds">{t('palette.goldDesc')}</div>
                </div>
              </Sw>
              <Sw>
                <span className="chipc" style={{ background: 'var(--lapis)' }} />
                <div>
                  <div className="nm">{t('palette.lapis')}</div>
                  <div className="ds">{t('palette.lapisDesc')}</div>
                </div>
              </Sw>
              <Sw>
                <span className="chipc" style={{ background: 'var(--pending)' }} />
                <div>
                  <div className="nm">{t('palette.candle')}</div>
                  <div className="ds">{t('palette.candleDesc')}</div>
                </div>
              </Sw>
            </Swatches>
          </Card>

          <Card>
            <Eyebrow as="span">{t('type.title')}</Eyebrow>
            <div style={{ marginTop: '8px' }}>
              <TypeRow>
                <div className="lbl">{t('type.serif')}</div>
                <Serif style={{ fontSize: '1.35rem', lineHeight: 1.3 }}>
                  {t('type.serifSample')}
                </Serif>
              </TypeRow>
              <TypeRow>
                <div className="lbl">{t('type.sans')}</div>
                <div style={{ fontSize: '0.98rem' }}>{t('type.sansSample')}</div>
              </TypeRow>
              <TypeRow>
                <div className="lbl">{t('type.mono')}</div>
                <Mono style={{ fontSize: '0.9rem' }}>{t('type.monoSample')}</Mono>
              </TypeRow>
            </div>
          </Card>

          <Card>
            <Eyebrow as="span">{t('states.title')}</Eyebrow>
            <States style={{ marginTop: '14px' }}>
              <div className="st">
                <StateChip state="available">{tState('available')}</StateChip>
                <small>{t('states.available')}</small>
              </div>
              <div className="st">
                <StateChip state="pending">{tState('pending')}</StateChip>
                <small>{t('states.pending')}</small>
              </div>
              <div className="st">
                <StateChip state="registered">{tState('registered')}</StateChip>
                <small>{t('states.registered')}</small>
              </div>
              <p className="note">{t('states.note')}</p>
            </States>
          </Card>
        </Grid>

        <Card style={{ marginTop: '20px' }}>
          <Eyebrow as="span">{t('primitives.title')}</Eyebrow>
          <div style={{ marginTop: '16px' }}>
            <Row>
              <StateChip state="available">{tState('available')}</StateChip>
              <StateChip state="pending">{tState('pending')}</StateChip>
              <StateChip state="registered">{tState('registered')}</StateChip>
              <StateChip state="registered" />
            </Row>
            <Row>
              <Button $variant="gold">{t('primitives.adopt')} →</Button>
              <Button $variant="ghost">{t('primitives.secondary')}</Button>
              <Button $variant="ghost" disabled>
                {t('primitives.secondary')}
              </Button>
            </Row>
            <Row>
              <SegmentedControl
                ariaLabel={t('primitives.segmented')}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'text', label: t('primitives.segByText') },
                  { value: 'ref', label: t('primitives.segByRef') },
                ]}
              />
              <Tooltip content={t('primitives.tooltipBody')}>
                <DemoCell type="button">{t('primitives.tooltipTrigger')}</DemoCell>
              </Tooltip>
            </Row>
            <Row>
              <Legend>
                <span>{t('primitives.heatmapScaleLow')}</span>
                <HeatRamp aria-hidden="true" />
                <span>{t('primitives.heatmapScaleHigh')}</span>
              </Legend>
            </Row>
          </div>
        </Card>
      </Wrap>
    </Section>
  )
}
