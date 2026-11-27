import { makeAutoObservable } from 'mobx'
import type { LangKey } from 'i18n'

const STORAGE_LANG_KEY = 'EPUB_CREATOR_LANG'
const STORAGE_THEME_KEY = 'EPUB_CREATOR_THEME'

export type ThemeMode = 'dark' | 'light' | 'auto'
const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'auto']

function detectDefaultLang(): LangKey {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem(STORAGE_LANG_KEY)
  if (saved === 'en' || saved === 'zh') return saved
  // auto-detect from browser
  const nav = navigator.language || ''
  return nav.startsWith('zh') ? 'zh' : 'en'
}

function detectDefaultTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  const saved = localStorage.getItem(STORAGE_THEME_KEY)
  if (saved === 'dark' || saved === 'light' || saved === 'auto') return saved
  return 'auto'
}

function resolveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme !== 'auto') return theme
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

class Store {
  modalBookVisible = false
  modalContentVisible = false
  modalPageVisible = false
  maxCardBoxCountInOneRow = 0
  selectedPageIndex: number | null = null
  fileName = ``
  lang: LangKey = 'en'
  theme: ThemeMode = 'auto'
  isLoading = false
  loadingText = ''
  isPreviewOpen = false
  previewPageIndex: number | null = null

  firstImport = true

  constructor() {
    this.lang = detectDefaultLang()
    this.theme = detectDefaultTheme()
    makeAutoObservable(this)
    this.applyTheme(this.theme)

    // keep "auto" in sync with the OS appearance while it's active
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'auto') {
          this.applyTheme('auto')
        }
      })
    }
  }

  toggleBookVisible(fileName?: string) {
    this.modalBookVisible = !this.modalBookVisible
    if (fileName && this.firstImport) {
      this.fileName = fileName
    }
  }

  firstUploaded() {
    this.firstImport = false
  }

  toggleContentVisible() {
    this.modalContentVisible = !this.modalContentVisible
  }

  togglePageVisible() {
    this.modalPageVisible = !this.modalPageVisible
  }

  hideModal() {
    Object.assign(this, {
      modalBookVisible: false,
      modalContentVisible: false,
      modalPageVisible: false,
    })
  }

  selectPageIndex(index: number | null) {
    if (index === null) {
      this.selectedPageIndex = null
    } else if (this.selectedPageIndex === index) {
      this.selectedPageIndex = null
    } else {
      this.selectedPageIndex = index
    }
  }

  setLang(lang: LangKey) {
    this.lang = lang
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, lang)
    }
  }

  setLoading(val: boolean, text: string = '') {
    this.isLoading = val
    this.loadingText = text
  }

  applyTheme(theme: ThemeMode) {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (resolveTheme(theme) === 'light') {
        root.classList.add('light-theme')
        root.classList.remove('dark-theme')
        root.setAttribute('data-bs-theme', 'light')
      } else {
        root.classList.add('dark-theme')
        root.classList.remove('light-theme')
        root.setAttribute('data-bs-theme', 'dark')
      }
    }
  }

  setTheme(theme: ThemeMode) {
    this.theme = theme
    this.applyTheme(theme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_THEME_KEY, theme)
    }
  }

  cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(this.theme) + 1) % THEME_CYCLE.length]
    this.setTheme(next)
  }

  openPreview(index: number) {
    this.isPreviewOpen = true
    this.previewPageIndex = index
  }

  closePreview() {
    this.isPreviewOpen = false
    this.previewPageIndex = null
  }

  nextPreviewPage(maxLen: number) {
    if (this.previewPageIndex !== null && this.previewPageIndex < maxLen - 1) {
      this.previewPageIndex++
    }
  }

  prevPreviewPage() {
    if (this.previewPageIndex !== null && this.previewPageIndex > 0) {
      this.previewPageIndex--
    }
  }
}

export default Store