import { useEffect, useState } from 'react'
import { Modal, ReceiptItemRow, EmptyState } from './ds'
import { useLanguage } from '../contexts/LanguageContext'
import { SupabaseService } from '../services/supabaseService'
import { Receipt, ProductHistory, Product } from '../lib/supabase'

interface ReceiptSheetProps {
  receipt: Receipt
  familyId: number
  onClose: () => void
  onSetLikeStatus?: (productId: number, next: -1 | 1 | null) => Promise<void> | void
}

const formatMoney = (amount: number, lang: 'ru' | 'pt') => {
  const n = Number(amount || 0).toFixed(2)
  return lang === 'pt' ? `${n.replace('.', ',')} €` : `€${n}`
}

const formatDate = (iso: string, lang: 'ru' | 'pt') => {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ReceiptSheet: React.FC<ReceiptSheetProps> = ({ receipt, familyId, onClose, onSetLikeStatus }) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [items, setItems] = useState<Array<ProductHistory & { product?: Product }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    SupabaseService.getReceiptProducts(receipt.id, familyId)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((err) => console.error('Error loading receipt items:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [receipt.id, familyId])

  const t = lang === 'pt'
    ? { close: 'Fechar', title: formatDate(receipt.date, lang), items: (n: number) => `${n} art.`, empty: 'Sem artigos', loading: 'A carregar…' }
    : { close: 'Закрыть', title: formatDate(receipt.date, lang), items: (n: number) => `${n} поз.`, empty: 'Нет позиций', loading: 'Загрузка…' }

  return (
    <Modal wide title={t.title} closeLabel={t.close} onClose={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: 'var(--space-6) var(--space-7)',
          borderBottom: '1px solid var(--line-hairline)',
        }}
      >
        <span className="tnum" style={{ font: 'var(--type-body-sm)', color: 'var(--text-tertiary)' }}>
          {t.items(items.length || receipt.items_count)}
        </span>
        <span className="tnum" style={{ font: 'var(--fw-semibold) var(--fs-15)/1.35 var(--font-sans)' }}>
          {formatMoney(receipt.total_amount, lang)}
        </span>
      </div>

      {loading ? (
        <EmptyState title={t.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <div>
          {items.map((it, i) => {
            const p = it.product
            const primary = p ? (lang === 'pt' ? p.name : p.name_ru || p.name) : lang === 'pt' ? 'Artigo desconhecido' : 'Неизвестный товар'
            const original = p ? p.original_name || p.name : null
            const productId = p?.id
            return (
              <ReceiptItemRow
                key={it.id ?? i}
                first={i === 0}
                name={primary}
                originalName={lang === 'pt' ? null : original}
                pricePaid={null}
                lang={lang}
                likeStatus={p?.like_status ?? null}
                onLikeToggle={
                  productId && onSetLikeStatus
                    ? async (next) => {
                        // Оптимистично обновляем локальную копию (модалка отображает свою data)
                        setItems((prev) =>
                          prev.map((row) =>
                            row.product?.id === productId
                              ? { ...row, product: { ...row.product, like_status: next } as Product }
                              : row,
                          ),
                        )
                        try {
                          await onSetLikeStatus(productId, next)
                        } catch (err) {
                          console.error('receipt like toggle failed:', err)
                        }
                      }
                    : undefined
                }
              />
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default ReceiptSheet
