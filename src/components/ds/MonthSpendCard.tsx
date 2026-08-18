import { useEffect, useMemo, useRef } from 'react'
import { MonthlyStats } from '../../lib/supabase'
import { formatMonth, monthKeyOf, parseMonthKey } from '../../lib/monthI18n'

interface MonthSpendCardProps {
  stats: MonthlyStats[]
  lang: 'ru' | 'pt'
  activeMonthKey?: string | null
  onSelect?: (monthKey: string) => void
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

export function MonthSpendCard({ stats, lang, activeMonthKey, onSelect }: MonthSpendCardProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const items = useMemo(() => {
    const dedup = new Map<string, MonthlyStats>()
    for (const s of stats) {
      const p = parseMonthKey(s.year, s.month)
      if (!p) continue
      const key = `${p.y}-${String(p.m).padStart(2, '0')}`
      const prev = dedup.get(key)
      // при коллизии оставляем запись с большим total_spent
      if (!prev || Number(s.total_spent || 0) > Number(prev.total_spent || 0)) {
        dedup.set(key, s)
      }
    }
    return [...dedup.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, s]) => s)
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
        const key = monthKeyOf(s)
        const isActive = !!key && key === activeMonthKey
        const clickable = !!onSelect && !!key
        return (
          <button
            key={key ?? `${s.year}-${s.month}`}
            type="button"
            disabled={!clickable}
            onClick={clickable ? () => onSelect!(key!) : undefined}
            style={{
              scrollSnapAlign: 'start',
              flex: '0 0 auto',
              minWidth: 200,
              padding: 'var(--space-5) var(--space-7)',
              border: `1px solid ${isActive ? 'var(--stone-500)' : 'var(--line-hairline)'}`,
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              textAlign: 'left',
              cursor: clickable ? 'pointer' : 'default',
              font: 'inherit',
              color: 'inherit',
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
          </button>
        )
      })}
    </div>
  )
}
