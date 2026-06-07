import type { Locale } from './en'

const zh: Locale = {
  nav: {
    importImage: '图片文件',
    importZip: 'ZIP 压缩包',
    insertBlankPage: '插入空白页',
    generate: '生成 EPUB',
  },

  prompt: {
    newPageIndex: (max: number) => `新页码（1 – ${max}）：`,
    insertPageIndex: (max: number) => `插入位置（1 – ${max}）：`,
    removePage: (idx: number) => `确认删除第 ${idx + 1} 页？`,
  },

  alert: {
    error: '错误',
  },

  main: {
    ready: '准备就绪 🚀',
    import: '导入',
  },

  book: {
    modalTitle: '书籍信息',
    filename: '文件名',
    id: 'ID',
    title: '标题',
    author: '作者',
    subject: '主题',
    publisher: '出版商',
    saveSet: '保存预设',
    removeSet: '删除预设',
    analyze: '自动填写',
  },

  contents: {
    modalTitle: '目录',
    colIndex: '页码',
    colTitle: '标题',
    formMode: '表单模式',
    plainMode: '纯文本模式',
    sort: '排序',
    save: '保存',
    saveSet: '保存预设',
    removeSet: '删除预设',
    placeholder: '例如\n 1. 封面\n 2. 第一章\n 3. 第二章',
  },

  page: {
    modalTitle: '页面设置',
    size: '尺寸',
    position: '对齐方式',
    show: '显示模式',
    fit: '适配模式',
    direction: '阅读方向',
    cover: '封面',
    imageTag: '图片标签',
  },

  option: {
    center: '居中',
    between: '内侧',
    twoPages: '双页',
    onePage: '单页',
    stretch: '拉伸',
    fit: '适应',
    fill: '填充',
    rightJP: '右翻（日式）',
    left: '左翻',
    firstPage: '首页',
    alone: '独立封面',
  },

  lang: {
    en: 'EN',
    zh: '中文',
  },
}

export default zh
