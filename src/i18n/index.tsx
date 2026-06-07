import React, { createContext, useContext } from 'react'
import en from './en'
import zh from './zh'

import { Locale } from './en'

export type LangKey = 'en' | 'zh'

const locales = { en, zh } as const

export type LocaleStrings = Locale

export function getLocale(lang: LangKey): LocaleStrings {
  return locales[lang]
}

// ── Context ──────────────────────────────────────────────────────────────────
export const I18nContext = createContext<LocaleStrings>(en as Locale)

/** Consume the current locale strings anywhere inside <I18nProvider>. */
export function useI18n(): LocaleStrings {
  return useContext(I18nContext)
}

// ── Provider component ────────────────────────────────────────────────────────
export function I18nProvider({
  lang,
  children,
}: {
  lang: LangKey
  children: React.ReactNode
}) {
  const locale = getLocale(lang)
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>
}

export { en, zh }
