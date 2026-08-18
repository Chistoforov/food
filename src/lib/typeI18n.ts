export interface TypeTranslationMaps {
  ruToPt: Record<string, string>
  ptToRu: Record<string, string>
}

export const EMPTY_TRANSLATIONS: TypeTranslationMaps = { ruToPt: {}, ptToRu: {} }

const warned = new Set<string>()

export const displayType = (
  type: string,
  lang: 'ru' | 'pt',
  maps: TypeTranslationMaps,
): string => {
  if (!type) return ''
  if (lang === 'ru') {
    return maps.ptToRu[type] || type
  }
  const pt = maps.ruToPt[type]
  if (pt) return pt
  if (!warned.has(type)) {
    warned.add(type)
    console.warn(`[typeI18n] missing PT translation for "${type}"`)
  }
  return type
}
