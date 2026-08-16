import { CSSProperties } from 'react'

type IconName = 'chevron-right' | 'chevron-left' | 'chevron-down' | 'chevron-up' | 'check'

const PATHS: Record<IconName, string> = {
  'chevron-right': 'M6 3.5 L10.5 8 L6 12.5',
  'chevron-left': 'M10 3.5 L5.5 8 L10 12.5',
  'chevron-down': 'M3.5 6 L8 10.5 L12.5 6',
  'chevron-up': 'M3.5 10 L8 5.5 L12.5 10',
  check: 'M3 8.5 L6.5 12 L13 4.5',
}

interface IconProps {
  name?: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}

export function Icon({ name = 'chevron-right', size = 16, color = 'currentColor', strokeWidth = 1.5, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ display: 'block', flex: 'none', ...style }}>
      <path d={PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
