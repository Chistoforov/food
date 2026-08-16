import { CSSProperties } from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: string
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 12, radius = 'var(--radius-xs)', style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: 'var(--stone-100)',
        animation: 'pantry-skeleton 1.6s var(--ease-standard) infinite',
        ...style,
      }}
    />
  )
}
