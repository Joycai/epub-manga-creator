const en = {
  // Nav / Toolbar
  nav: {
    importImage: 'Image files',
    importZip: 'ZIP archive',
    insertBlankPage: 'Insert blank page',
    generate: 'Generate EPUB',
    themeLight: 'Theme: Light',
    themeDark: 'Theme: Dark',
    themeAuto: 'Theme: Auto (system)',
    reset: 'Reset workspace',
  },

  // Confirm dialogs
  confirm: {
    reset: 'Clear the workspace? All imported pages will be removed. This cannot be undone.',
  },

  // Page operation prompts
  prompt: {
    newPageIndex: (max: number) => `New page index (1 – ${max}):`,
    insertPageIndex: (max: number) => `Insert at index (1 – ${max}):`,
    removePage: (idx: number) => `Remove page ${idx + 1}?`,
  },

  // Alert messages
  alert: {
    error: 'Error',
  },

  // Main area
  main: {
    ready: 'Ready 🚀',
    import: 'Import',
    zoomPreview: 'Zoom preview',
    restoreDetected: 'Detected a backup from your last session. Would you like to restore it?',
    restore: 'Restore',
    dismiss: 'Dismiss',
  },

  // Lightbox (page preview)
  lightbox: {
    page: 'Page',
    blankPage: 'Blank page',
    close: 'Close',
    prev: 'Previous page',
    next: 'Next page',
  },

  // Loading overlay
  loading: {
    generating: 'Generating EPUB…',
  },

  // Modal – Book settings
  book: {
    modalTitle: 'Book',
    filename: 'Filename',
    id: 'ID',
    title: 'Title',
    author: 'Author',
    subject: 'Subject',
    publisher: 'Publisher',
    language: 'Language',
    saveSet: 'Save set',
    removeSet: 'Remove set',
    analyze: 'Auto-fill',
  },

  // Modal – Contents / TOC
  contents: {
    modalTitle: 'Contents',
    colIndex: 'Index',
    colTitle: 'Title',
    formMode: 'Form mode',
    plainMode: 'Plain text mode',
    sort: 'Sort',
    save: 'Save',
    saveSet: 'Save set',
    removeSet: 'Remove set',
    placeholder: 'e.g.\n 1. Cover\n 2. Chapter 1\n 3. Chapter 2',
  },

  // Modal – Page settings
  page: {
    modalTitle: 'Page',
    size: 'Size',
    position: 'Position',
    show: 'Show',
    fit: 'Fit',
    background: 'Background',
    direction: 'Direction',
    cover: 'Cover',
    imageTag: 'Image tag',
    spreadPosition: 'Spread slot',
  },

  // Option labels (shared)
  option: {
    center: 'Center',
    between: 'Between',
    twoPages: 'Two pages',
    onePage: 'One page',
    stretch: 'Stretch',
    fit: 'Fit',
    fill: 'Fill',
    white: 'White',
    black: 'Black',
    rightJP: 'Right (Japanese)',
    left: 'Left',
    firstPage: 'First page',
    alone: 'Alone',
    auto: 'Auto',
    spreadCenter: 'Center (full)',
    spreadLeft: 'Left page',
    spreadRight: 'Right page',
  },

  // Language switcher
  lang: {
    en: 'EN',
    zh: '中文',
  },
} as const

export default en

export type Locale = {
  nav: Record<keyof typeof en.nav, string>
  prompt: {
    newPageIndex: (max: number) => string
    insertPageIndex: (max: number) => string
    removePage: (idx: number) => string
  }
  alert: Record<keyof typeof en.alert, string>
  confirm: Record<keyof typeof en.confirm, string>
  main: Record<keyof typeof en.main, string>
  lightbox: Record<keyof typeof en.lightbox, string>
  loading: Record<keyof typeof en.loading, string>
  book: Record<keyof typeof en.book, string>
  contents: Record<keyof typeof en.contents, string>
  page: Record<keyof typeof en.page, string>
  option: Record<keyof typeof en.option, string>
  lang: Record<keyof typeof en.lang, string>
}
