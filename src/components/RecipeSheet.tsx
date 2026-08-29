import { Modal } from './ds'
import { useLanguage } from '../contexts/LanguageContext'
import type { Recipe, RecipeIngredient } from '../lib/supabase'

interface RecipeSheetProps {
  recipe: Recipe
  ingredients: RecipeIngredient[]
  availableTypes: Set<string>
  onClose: () => void
}

const RecipeSheet: React.FC<RecipeSheetProps> = ({ recipe, ingredients, availableTypes, onClose }) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language

  const t = lang === 'pt'
    ? { close: 'Fechar', category: 'Categoria', ingredients: 'Ingredientes', open: 'Abrir no Pingo Doce', have: 'em casa', missing: 'em falta' }
    : { close: 'Закрыть', category: 'Категория', ingredients: 'Ингредиенты', open: 'Открыть на Pingo Doce', have: 'есть', missing: 'нет' }

  const title = lang === 'pt' ? recipe.name_pt : (recipe.name_ru || recipe.name_pt)

  const hasIngredient = (ing: RecipeIngredient) =>
    Boolean(ing.product_type && availableTypes.has(ing.product_type))

  return (
    <Modal open title={title} onClose={onClose} closeLabel={t.close}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {recipe.image_url && (
          <img
            src={recipe.image_url}
            alt={title}
            style={{
              width: '100%',
              maxHeight: 260,
              objectFit: 'cover',
              display: 'block',
              background: 'var(--surface-sunken)',
            }}
          />
        )}

        <div style={{ padding: 'var(--space-6) var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {recipe.category && (
            <div style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
              {t.category}: {recipe.category}
            </div>
          )}

          <div>
            <div style={{ font: 'var(--type-section)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
              {t.ingredients}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ingredients.map((ing) => {
                const have = hasIngredient(ing)
                const display = lang === 'pt' ? ing.raw_text : (ing.name_ru || ing.name_pt)
                const qty = lang === 'ru' && ing.quantity_text ? ing.quantity_text : null
                return (
                  <div
                    key={ing.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-3) 0',
                      borderTop: '1px solid var(--line-hairline)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: have ? 'rgba(45,135,90,0.18)' : 'rgba(180,80,80,0.14)',
                        color: have ? '#256a48' : '#8a3535',
                        font: 'var(--type-meta)',
                        flex: 'none',
                      }}
                      aria-label={have ? t.have : t.missing}
                      title={have ? t.have : t.missing}
                    >
                      {have ? '✓' : '·'}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        color: have ? 'var(--text-primary)' : 'var(--text-secondary)',
                        font: 'var(--type-body)',
                      }}
                    >
                      {display}
                    </span>
                    {qty && (
                      <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', flex: 'none' }}>
                        {qty}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <a
            href={recipe.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '0 var(--space-6)',
              border: '1px solid var(--stone-900)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--stone-900)',
              color: 'var(--text-inverse)',
              font: 'var(--type-label)',
              textDecoration: 'none',
            }}
          >
            {t.open}
          </a>
        </div>
      </div>
    </Modal>
  )
}

export default RecipeSheet
