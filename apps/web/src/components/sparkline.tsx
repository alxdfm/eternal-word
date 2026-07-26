'use client'

import { useId } from 'react'
import { useTheme } from 'styled-components'

/**
 * Cumulative-trend sparkline (dashboard). Area fill + line + a highlighted end
 * point, on a discreet baseline — one gold stroke, no axes. Pure SVG, scaled to
 * a fixed viewBox; a flat or single-point series degrades gracefully.
 */
export function Sparkline({
  values,
  width = 520,
  height = 56,
  label,
}: {
  values: readonly number[]
  width?: number
  height?: number
  label?: string
}) {
  const theme = useTheme()
  const gradientId = useId()

  if (values.length === 0) {
    return null
  }

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const pad = 3
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)
  const points = values.map((v, i) => [pad + i * stepX, y(v)] as const)

  const line = points
    .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ')
  const [lastX, lastY] = points[points.length - 1] as readonly [number, number]
  const area = `${line} L${lastX.toFixed(1)},${height} L${pad},${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.color.gold} stopOpacity="0.28" />
          <stop offset="100%" stopColor={theme.color.gold} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={theme.color.gold}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3" fill={theme.color.goldLit} />
    </svg>
  )
}
