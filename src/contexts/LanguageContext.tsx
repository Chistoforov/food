import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Language = 'ru' | 'pt'

interface LanguageContextType {
  language: Language
  setLanguage: (l: Language) => void
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType)

const STORAGE_KEY = 'grocery_language'

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return stored === 'pt' ? 'pt' : 'ru'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const setLanguage = (l: Language) => setLanguageState(l)

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)

// Formats a product name based on language:
// - ru: "Русское название (Portuguese Original)" if name_ru present, else fall back to PT only
// - pt: only the original Portuguese
export function formatProductName(
  name: string,
  name_ru: string | null | undefined,
  language: Language,
): { primary: string; secondary: string | null } {
  if (language === 'pt' || !name_ru) {
    return { primary: name, secondary: null }
  }
  return { primary: name_ru, secondary: name }
}
