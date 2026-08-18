import { Card, SectionHeader, ReceiptRow } from './index'
import { Receipt } from '../../lib/supabase'

interface RecentReceiptsSectionProps {
  receipts: Receipt[]
  lang: 'ru' | 'pt'
  onOpenReceipt: (receipt: Receipt) => void
}

const formatDate = (iso: string, lang: 'ru' | 'pt') => {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'ru-RU', { day: 'numeric', month: 'long' })
}

const formatMoney = (amount: number, lang: 'ru' | 'pt') => {
  const n = Number(amount || 0).toFixed(2)
  return lang === 'pt' ? `${n.replace('.', ',')} €` : `€${n}`
}

export function RecentReceiptsSection({ receipts, lang, onOpenReceipt }: RecentReceiptsSectionProps) {
  if (receipts.length === 0) return null
  const title = lang === 'pt' ? 'Recibos recentes' : 'Последние чеки'
  return (
    <>
      <SectionHeader count={receipts.length}>{title}</SectionHeader>
      <Card padded={false}>
        {receipts.map((r, i) => (
          <ReceiptRow
            key={r.id}
            first={i === 0}
            date={formatDate(r.date, lang)}
            total={formatMoney(r.total_amount, lang)}
            itemCount={r.items_count}
            lang={lang}
            onClick={() => onOpenReceipt(r)}
          />
        ))}
      </Card>
    </>
  )
}
