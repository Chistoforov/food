import { useState } from 'react'
import { Modal, TextField, Select, Button } from './ds'
import { useLanguage } from '../contexts/LanguageContext'
import { SupabaseService } from '../services/supabaseService'
import type { ProcessedProduct } from './ProductsPage'

interface ProductSheetProps {
  product: ProcessedProduct
  familyId: number
  typeTranslations: Record<string, string>
  onClose: () => void
  onSaved: (updated: { name_ru?: string | null; product_type?: string | null }) => Promise<void> | void
}

const ProductSheet: React.FC<ProductSheetProps> = ({ product, familyId, typeTranslations, onClose, onSaved }) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [nameRu, setNameRu] = useState(product.nameRu ?? '')
  const [type, setType] = useState(product.product_type ?? '')
  const [saving, setSaving] = useState(false)

  const t = lang === 'pt'
    ? { close: 'Fechar', name: 'Nome curto (RU)', nameHint: 'Só a tradução russa. O PT permanece igual.', original: 'Original do talão', type: 'Categoria', save: 'Guardar', cancel: 'Cancelar', empty: '— sem categoria' }
    : { close: 'Закрыть', name: 'Короткое имя (RU)', nameHint: 'Только русский перевод. Оригинал не меняется.', original: 'Оригинал из чека', type: 'Категория', save: 'Сохранить', cancel: 'Отмена', empty: '— без категории' }

  const options = [
    { value: '', label: t.empty },
    ...Array.from(new Set([type, ...Object.keys(typeTranslations)].filter(Boolean)))
      .sort()
      .map((v) => ({ value: v, label: lang === 'ru' && typeTranslations[v] ? `${typeTranslations[v]} · ${v}` : v })),
  ]

  const title = lang === 'pt' ? product.originalName || product.name : nameRu || product.name || product.originalName || ''

  const handleSave = async () => {
    try {
      setSaving(true)
      const updates: { name_ru?: string | null; product_type?: string | null } = {}
      const nextNameRu = nameRu.trim() || null
      const nextType = type.trim().toLowerCase() || null
      if (nextNameRu !== (product.nameRu ?? null)) updates.name_ru = nextNameRu
      if (nextType !== (product.product_type ?? null)) updates.product_type = nextType
      if (Object.keys(updates).length > 0) {
        await onSaved(updates)
        if ('product_type' in updates) {
          try {
            await SupabaseService.updateProductStats(product.id, familyId)
          } catch (err) {
            console.warn('updateProductStats failed:', err)
          }
        }
      }
      onClose()
    } catch (err) {
      console.error('Save product failed:', err)
      alert(lang === 'pt' ? 'Não foi possível guardar.' : 'Не удалось сохранить.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={title}
      closeLabel={t.close}
      onClose={onClose}
      footer={
        <>
          <Button style={{ flex: 1 }} onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button style={{ flex: 2 }} variant="primary" onClick={handleSave} disabled={saving}>
            {t.save}
          </Button>
        </>
      }
    >
      <div style={{ padding: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        <TextField label={t.name} value={nameRu} hint={t.nameHint} onChange={(e) => setNameRu(e.target.value)} />

        <div>
          <div style={{ font: 'var(--type-label)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>{t.original}</div>
          <div
            style={{
              font: 'var(--type-original)',
              color: 'var(--text-disabled)',
              padding: 'var(--space-5) var(--space-6)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--line-hairline)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {product.originalName || product.name}
          </div>
        </div>

        <Select label={t.type} value={type} onChange={(e) => setType(e.target.value)} options={options} />
      </div>
    </Modal>
  )
}

export default ProductSheet
