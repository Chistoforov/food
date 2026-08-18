import { useEffect, useMemo, useRef } from 'react'
import { MonthlyStats } from '../../lib/supabase'

interface MonthSpendCardProps {
  stats: MonthlyStats[]
  lang: 'ru' | 'pt'
}

const formatMonth = (year: number, month: string, lang: 'ru' | 'pt') => {
  const m = parseInt(month, 10)
  if (!year || !m) return ''
  const d = new Date(year, m - 1, 1)
  const raw = d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'ru-RU', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const formatMoney = (amount: number, lang: 'ru' | 'pt') => {
  const n = Number(amount || 0).toFixed(2)
  return lang === 'pt' ? `${n.replace('.', ',')} €` : `€${n}`
}

const receiptsLabel = (n: number, lang: 'ru' | 'pt') => {
  if (lang === 'pt') return `${n} ${n === 1 ? 'recibo' : 'recibos'}`
  const mod10 = n % 10
  const mod100 = n % 100
  const suffix = mod10 === 1 && mod100 !== 11 ? 'чек' : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 'чека' : 'чеков'
  return `${n} ${suffix}`
}

export function MonthSpendCard({ stats, lang }: MonthSpendCardProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const items = useMemo(() => {
    return [...stats]
      .filter((s) => s.year && s.month)
      .sort((a, b) => {
        const ka = `${a.year}-${a.month.padStart(2, '0')}`
        const kb = `${b.year}-${b.month.padStart(2, '0')}`
        return kb.localeCompare(ka)
      })
  }, [stats])

  useEffect(() => {
    if (!scrollerRef.current || items.length === 0) return
    scrollerRef.current.scrollLeft = 0
  }, [items.length])

  if (items.length === 0) return null

  const emptyLabel = lang === 'pt' ? 'sem gastos' : 'нет трат'

  return (
    <div
      ref={scrollerRef}
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        padding: 'var(--space-6) 0 var(--space-4)',
        margin: '0 calc(var(--gutter-mobile) * -1)',
        paddingLeft: 'var(--gutter-mobile)',
        paddingRight: 'var(--gutter-mobile)',
      }}
    >
      {items.map((s) => {
        const spent = Number(s.total_spent || 0)
        return (
          <div
            key={`${s.year}-${s.month}`}
            style={{
              scrollSnapAlign: 'start',
              flex: '0 0 auto',
              minWidth: 200,
              padding: 'var(--space-5) var(--space-7)',
              border: '1px solid var(--line-hairline)',
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {formatMonth(s.year, s.month, lang)}
            </span>
            <span className="tnum" style={{ font: 'var(--type-num)', fontSize: 'var(--fs-18)', color: 'var(--text-primary)' }}>
              {spent > 0 ? formatMoney(spent, lang) : emptyLabel}
            </span>
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
              {receiptsLabel(s.receipts_count || 0, lang)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
