import type { MonthlyStats } from './supabase'

export interface ParsedMonth {
  y: number
  m: number
}

export const parseMonthKey = (year: number, month: string): ParsedMonth | null => {
  // month может быть 'YYYY-MM' или 'MM'
  const parts = month.split('-')
  const mm = parts.length > 1 ? parseInt(parts[1], 10) : parseInt(month, 10)
  const yy = parts.length > 1 ? parseInt(parts[0], 10) : year
  if (!yy || !mm || mm < 1 || mm > 12) return null
  return { y: yy, m: mm }
}

export const monthKeyOf = (stat: Pick<MonthlyStats, 'year' | 'month'>): string | null => {
  const p = parseMonthKey(stat.year, stat.month)
  if (!p) return null
  return `${p.y}-${String(p.m).padStart(2, '0')}`
}

export const parseMonthString = (key: string): ParsedMonth | null => {
  const parts = key.split('-')
  if (parts.length !== 2) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (!y || !m || m < 1 || m > 12) return null
  return { y, m }
}

export const formatMonth = (year: number, month: string, lang: 'ru' | 'pt'): string => {
  const parsed = parseMonthKey(year, month)
  if (!parsed) return ''
  const d = new Date(parsed.y, parsed.m - 1, 1)
  const raw = d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'ru-RU', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export const shortMonthLabel = (key: string, lang: 'ru' | 'pt'): string => {
  const p = parseMonthString(key)
  if (!p) return ''
  const d = new Date(p.y, p.m - 1, 1)
  const month = d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'ru-RU', { month: 'short' })
  const trimmed = month.replace(/\.$/, '')
  const cap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return `${cap} ${String(p.y).slice(-2)}`
}
