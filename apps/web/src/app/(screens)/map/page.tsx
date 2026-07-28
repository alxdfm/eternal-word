'use client'

import {
  HeatRamp,
  Section,
  SectionHead,
  Serif,
  Tooltip,
  Wrap,
  heatBackground,
  isLit,
} from '@/components/ui'
import { useBookProgress, useChapterProgress } from '@/hooks/queries'
import { useBookLabels } from '@/hooks/use-books'
import type { BookProgress } from '@/lib/api'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import styled from 'styled-components'

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.76rem;
  color: ${({ theme }) => theme.color.muted};
`
const Group = styled.div`
  margin-bottom: 26px;
`
const GroupHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  h3 {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: 1.05rem;
    margin: 0;
  }
  .c {
    font-size: 0.76rem;
    color: ${({ theme }) => theme.color.muted};
    font-family: ${({ theme }) => theme.font.mono};
  }
`
const Mosaic = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 7px;
`
const Tile = styled.button<{ $selected: boolean }>`
  position: relative;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ $selected, theme }) => ($selected ? theme.color.gold : theme.color.rule)};
  box-shadow: ${({ $selected, theme }) => ($selected ? `0 0 0 1px ${theme.color.gold}, ${theme.shadow.glow}` : 'none')};
  padding: 9px 10px;
  min-height: 58px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
  font-family: inherit;
  transition: transform 0.12s ease, border-color 0.12s ease;
  width: 100%;
  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => theme.color.gold};
  }
  .ab {
    font-size: 0.8rem;
    font-weight: 600;
  }
  .pc {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.68rem;
    opacity: 0.85;
  }
`
const Detail = styled.div`
  margin-top: 22px;
  background: ${({ theme }) => theme.color.panel};
  border: 1px solid ${({ theme }) => theme.color.rule};
  border-radius: ${({ theme }) => theme.radius.xl};
  padding: 20px;
  box-shadow: ${({ theme }) => theme.shadow.card};
`
const DetailHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  .bk {
    font-family: ${({ theme }) => theme.font.serif};
    font-size: 1.25rem;
  }
  .meta {
    font-size: 0.82rem;
    color: ${({ theme }) => theme.color.muted};
    font-family: ${({ theme }) => theme.font.mono};
  }
`
const Chapters = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(30px, 1fr));
  gap: 6px;
`
const Chapter = styled.div`
  aspect-ratio: 1 / 1;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid ${({ theme }) => theme.color.rule};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 0.66rem;
`
const Note = styled.p`
  color: ${({ theme }) => theme.color.muted};
`

function ratioOf(registered: number, registrable: number): number {
  return registrable > 0 ? registered / registrable : 0
}

/** Piso mínimo da escala do heatmap: sem ele, no início (cobertura ~0%) o livro
 * mais registrado — mesmo com 1% — apareceria dourado cheio, exagerando o
 * progresso. Com piso, "quase nada registrado" fica honestamente apagado. */
const HEAT_FLOOR = 0.05

/** Topo da escala de cor do mapa: o máximo real de cobertura entre os livros
 * (com piso). A cor de cada tile é `ratio / scale` — o líder fica dourado cheio e
 * os demais relativos a ele. Responde ao "por que 40%?": não é fixo, é o máximo
 * atual (UX-05). O rótulo/tooltip de cada tile segue mostrando o % absoluto. */
function coverageScale(books: readonly BookProgress[]): number {
  const max = books.reduce((m, b) => Math.max(m, ratioOf(b.registered, b.registrable)), 0)
  return Math.max(max, HEAT_FLOOR)
}

function BookMosaic({
  books,
  scale,
  selected,
  onSelect,
}: {
  books: readonly BookProgress[]
  scale: number
  selected: number | null
  onSelect: (book: number) => void
}) {
  const labels = useBookLabels()
  const f = useFormatter()
  const t = useTranslations('map')
  return (
    <Mosaic>
      {books.map((b) => {
        const ratio = ratioOf(b.registered, b.registrable)
        const heat = ratio / scale
        const lit = isLit(heat)
        return (
          <Tooltip
            key={b.book}
            stretch
            content={
              <>
                <Serif style={{ fontWeight: 600 }}>{labels.name(b.book)}</Serif>
                <div style={{ marginTop: 4 }}>
                  {t('chapterTooltip', { registered: b.registered, registrable: b.registrable })}
                </div>
              </>
            }
          >
            <Tile
              type="button"
              $selected={selected === b.book}
              onClick={() => onSelect(b.book)}
              style={{
                background: heatBackground(heat),
                color: lit ? 'var(--gold-on)' : undefined,
              }}
            >
              <span className="ab">{labels.abbr(b.book)}</span>
              <span className="pc">
                {f.number(ratio, { style: 'percent', maximumFractionDigits: 0 })}
              </span>
            </Tile>
          </Tooltip>
        )
      })}
    </Mosaic>
  )
}

function BookDetail({ book, scale }: { book: number; scale: number }) {
  const labels = useBookLabels()
  const t = useTranslations('map')
  const f = useFormatter()
  const { data } = useChapterProgress(book)
  const chapters = data?.chapters ?? []
  const registered = chapters.reduce((sum, c) => sum + c.registered, 0)
  const registrable = chapters.reduce((sum, c) => sum + c.registrable, 0)
  return (
    <Detail>
      <DetailHead>
        <span className="bk">{labels.name(book)}</span>
        <span className="meta">{t('chaptersMeta', { registered, registrable })}</span>
      </DetailHead>
      <Chapters>
        {chapters.map((c) => {
          const ratio = ratioOf(c.registered, c.registrable)
          return (
            <Tooltip
              key={c.chapter}
              stretch
              content={`${t('chapterLabel', { chapter: c.chapter })} · ${t('chapterTooltip', { registered: c.registered, registrable: c.registrable })}`}
            >
              <Chapter
                style={{
                  background: heatBackground(ratio / scale),
                  color: isLit(ratio / scale) ? 'var(--gold-on)' : undefined,
                }}
              >
                {f.number(c.chapter)}
              </Chapter>
            </Tooltip>
          )
        })}
      </Chapters>
    </Detail>
  )
}

export default function MapPage() {
  const t = useTranslations('map')
  const tc = useTranslations('common')
  const f = useFormatter()
  const [selected, setSelected] = useState<number | null>(null)
  const { data, isPending, isError } = useBookProgress()

  const old = data?.filter((b) => b.testament === 'OLD') ?? []
  const neu = data?.filter((b) => b.testament === 'NEW') ?? []
  const scale = coverageScale(data ?? [])
  const asPercent = (r: number) => f.number(r, { style: 'percent', maximumFractionDigits: 0 })

  return (
    <Section>
      <Wrap>
        <SectionHead eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')}>
          <Legend>
            <span>{asPercent(0)}</span>
            <HeatRamp aria-hidden="true" />
            <span>{asPercent(scale)}</span>
          </Legend>
        </SectionHead>

        {isPending ? (
          <Note>{tc('loading')}</Note>
        ) : isError ? (
          <Note>{tc('error')}</Note>
        ) : (
          <>
            <Group>
              <GroupHead>
                <h3>{t('old')}</h3>
                <span className="c">{old.length}</span>
              </GroupHead>
              <BookMosaic books={old} scale={scale} selected={selected} onSelect={setSelected} />
            </Group>
            <Group>
              <GroupHead>
                <h3>{t('new')}</h3>
                <span className="c">{neu.length}</span>
              </GroupHead>
              <BookMosaic books={neu} scale={scale} selected={selected} onSelect={setSelected} />
            </Group>
            {selected !== null && <BookDetail book={selected} scale={scale} />}
          </>
        )}
      </Wrap>
    </Section>
  )
}
