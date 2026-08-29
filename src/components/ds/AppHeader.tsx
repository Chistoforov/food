import { CSSProperties, ReactNode } from 'react'

interface AppHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  style?: CSSProperties
}

const PD_BLACK = '#000D1B'
const PD_GREEN = '#8CC63F'
const GREEN_BAND_RATIO = 9.09091 / 40

export function AppHeader({ title, subtitle, right, style }: AppHeaderProps) {
  const greenBandPct = `${(GREEN_BAND_RATIO * 100).toFixed(4)}%`
  const blackBandPct = `${(100 - GREEN_BAND_RATIO * 100).toFixed(4)}%`

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'grid',
        gridTemplateRows: `${blackBandPct} ${greenBandPct}`,
        minHeight: 76,
        background: PD_BLACK,
        boxShadow: 'var(--shadow-sticky)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-6)',
          padding: '0 var(--gutter-mobile)',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              font: 'var(--type-screen-title)',
              letterSpacing: 'var(--ls-tight)',
              color: '#fff',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div style={{ font: 'var(--type-meta)', color: 'rgba(255,255,255,0.68)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {right}
          <img
            src="/pingo-doce-wordmark.svg"
            alt="Pingo Doce"
            style={{ height: 38, width: 'auto', display: 'block' }}
          />
        </div>
      </div>
      <div style={{ background: PD_GREEN }} />
    </header>
  )
}
