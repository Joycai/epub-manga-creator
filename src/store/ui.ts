import { makeAutoObservable, observable, action } from 'mobx'
import type { LangKey } from 'i18n'

const STORAGE_LANG_KEY = 'EPUB_CREATOR_LANG'

function detectDefaultLang(): LangKey {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem(STORAGE_LANG_KEY)
  if (saved === 'en' || saved === 'zh') return saved
  // auto-detect from browser
  const nav = navigator.language || ''
  return nav.startsWith('zh') ? 'zh' : 'en'
}

class Store {
  @observable modalBookVisible = false
  @observable modalContentVisible = false
  @observable modalPageVisible = false
  @observable maxCardBoxCountInOneRow = 0
  @observable selectedPageIndex: number | null = null
  @observable fileName = ``
  @observable lang: LangKey = 'en'

  firstImport = true

  constructor() {
    makeAutoObservable(this)
    this.lang = detectDefaultLang()
  }

  @action
  toggleBookVisible(fileName?: string) {
    this.modalBookVisible = !this.modalBookVisible
    if (fileName && this.firstImport) {
      this.fileName = fileName
    }
  }

  @action
  firstUploaded() {
    this.firstImport = false
  }

  @action
  toggleContentVisible() {
    this.modalContentVisible = !this.modalContentVisible
  }

  @action
  togglePageVisible() {
    this.modalPageVisible = !this.modalPageVisible
  }

  @action
  hideModal() {
    Object.assign(this, {
      modalBookVisible: false,
      modalPageVisible: false,
    })
  }

  @action
  selectPageIndex(index: number | null) {
    if (index === null) {
      this.selectedPageIndex = null
    } else if (this.selectedPageIndex === index) {
      this.selectedPageIndex = null
    } else {
      this.selectedPageIndex = index
    }
  }

  @action
  setLang(lang: LangKey) {
    this.lang = lang
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, lang)
    }
  }
}

export default Store