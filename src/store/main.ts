import React from 'react';
import { autorun, makeAutoObservable, runInAction, toJS } from "mobx"
import uuid from 'utils/get-uuid'
import Book, { StoreBook } from 'store/book'
import Ui from 'store/ui'
import Contents from 'store/contents'
import storeBlobs, { Store as Blobs } from 'store/blobs'
import { db } from 'utils/db'
import { getLocale } from 'i18n'
import JSZip from "jszip"

import getTemplateContainerXml from 'template/container.xml'
import getTemplatePageXhtml from 'template/page.xhtml'
import getTemplatePageImgXhtml from 'template/page_img.xhtml'
import getTemplateFixedLayoutJpCss from 'template/fixed-layout-jp.css'
import getTemplateStandardOpf from 'template/standard.opf'
import getTemplateNavigationDocumentsXhtml from 'template/navigation-documents.xhtml'

const htmlToEscape = (str: string): string => {
  // strip control chars that are invalid in XML 1.0 even when escaped
  // eslint-disable-next-line no-control-regex
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  const reg = /"|&|'|<|>|\\|[\x80-\xFF]|[\u0100-\u2700]/g

  return cleaned.replace(reg, ($0) => '&#' + $0.charCodeAt(0) + ';')
}

// Safe template interpolation: a plain-string replacement would interpret
// `$&`, `$'` etc. in user content as special replacement patterns.
const fillTemplate = (template: string, pattern: string | RegExp, value: string): string =>
  template.replace(pattern, () => value)

const getNumberStr = (num: number, zeroCount: number): string => {
  let str = String(num)
  let i = zeroCount - str.length
  while (i-- > 0) {
    str = '0' + str
  }
  return str
}

class Store {
  ui: Ui
  book: Book
  contents: Contents
  blobs: Blobs
  isAutoSaveActive = false

  // blob UUIDs already persisted to IndexedDB (not part of reactive state)
  savedBlobIDs: Set<string> = new Set()

  constructor() {
    this.ui = new Ui()
    this.book = new Book()
    this.contents = new Contents()
    this.blobs = storeBlobs

    makeAutoObservable(this, {
      savedBlobIDs: false,
    })

    try {
      const bookSets = JSON.parse(localStorage.getItem('EPUB_CREATOR_SAVED_SETS_BOOK') || '[]')
      const contentSets = JSON.parse(localStorage.getItem('EPUB_CREATOR_SAVED_SETS_CONTENTS') || '[]')

      runInAction(() => {
        this.book.savedSets = bookSets
        this.contents.savedSets = contentSets
      })
    } catch {
      // do nothing
    }
  }

  resetWorkspace() {
    this.book.reset()
    this.contents.reset()
    this.blobs.clear()
    this.ui.selectPageIndex(null)
    this.ui.firstImport = true
    this.ui.fileName = ''
    this.ui.modalBookVisible = false
    this.ui.modalContentVisible = false
    this.ui.modalPageVisible = false
    this.savedBlobIDs.clear()
    db.clearAll().catch(err => console.error('Failed to clear backup:', err))
  }

  setAutoSaveActive(value: boolean) {
    this.isAutoSaveActive = value
  }

  async restoreWorkspace() {
    const backup = await db.getMetadata('active_book')
    if (!backup || !Array.isArray(backup.pages) || backup.pages.length === 0) {
      return
    }

    const blobIDs: string[] = []
    const blobList: Blob[] = []

    for (const page of backup.pages as StoreBook.PageItem[]) {
      if (page.blank || !page.blobID) {
        continue
      }
      const blob = await db.getBlob(page.blobID)
      if (blob) {
        blobIDs.push(page.blobID)
        blobList.push(blob)
      }
    }

    await this.blobs.push(blobList, blobIDs)

    runInAction(() => {
      const available = new Set(blobIDs)
      this.book.pages = (backup.pages as StoreBook.PageItem[])
        .filter(page => page.blank || available.has(page.blobID))
        .map((page, i) => ({ ...page, index: i }))

      if (backup.bookInfo) {
        this.book.bookID = backup.bookInfo.bookID || this.book.bookID
        this.book.bookTitle = backup.bookInfo.bookTitle || ''
        this.book.bookAuthors = backup.bookInfo.bookAuthors?.length ? backup.bookInfo.bookAuthors : ['']
        this.book.bookSubject = backup.bookInfo.bookSubject || ''
        this.book.bookPublisher = backup.bookInfo.bookPublisher || ''
      }

      if (backup.pageSettings) {
        const s = backup.pageSettings
        if (Array.isArray(s.pageSize)) this.book.pageSize = s.pageSize
        if (s.pagePosition) this.book.pagePosition = s.pagePosition
        if (s.pageShow) this.book.pageShow = s.pageShow
        if (s.pageFit) this.book.pageFit = s.pageFit
        if (s.pageBackgroundColor) this.book.pageBackgroundColor = s.pageBackgroundColor
        if (s.pageDirection) this.book.pageDirection = s.pageDirection
        if (s.coverPosition) this.book.coverPosition = s.coverPosition
        if (s.imgTag) this.book.imgTag = s.imgTag
      }

      if (backup.contents && Array.isArray(backup.contents.list)) {
        this.contents.updateList(backup.contents.list)
      }

      this.ui.firstImport = false
      blobIDs.forEach(id => this.savedBlobIDs.add(id))
    })
  }

  importPageFromImages(fileList: File[]) {
    const uuids = fileList.map(() => uuid())

    this.book.pushNewPage(uuids)
    this.blobs.push(fileList, uuids)
  }

  replacePageIndex(index: number, targetIndex: number) {
    this.book.switchIndex(index, index > targetIndex ? targetIndex : targetIndex + 1)
    this.ui.selectPageIndex(targetIndex)

    const newIndexMap: Contents['indexMap'] = {}
    const list = toJS(this.contents.list)

    this.book.pages.forEach((pageItem, index) => {
      if (pageItem.index in this.contents.indexMap) {
        const listIndex = this.contents.indexMap[pageItem.index]
        newIndexMap[index] = listIndex
        list[listIndex].pageIndex = index
      }
    })

    this.contents.updateList(list)
    this.book.updatePageItemIndex()
  }

  async splitPage(index: number) {
    const pageItem = this.book.pages[index]
    const blobItem = this.blobs.blobs[pageItem.blobID]
    const uuids = [uuid(), uuid()]
    const mime = blobItem.blob.type

    const w1 = blobItem.originImage.width >> 1
    const w2 = blobItem.originImage.width - w1

    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')

    canvas1.width = w1
    canvas1.height = blobItem.originImage.height

    canvas2.width = w2
    canvas2.height = blobItem.originImage.height

    const ctx1 = canvas1.getContext('2d')
    const ctx2 = canvas2.getContext('2d')

    ctx1?.drawImage(blobItem.originImage, 0, 0)
    ctx2?.drawImage(blobItem.originImage, 0 - w1, 0)

    const blobs = await Promise.all([
      new Promise<Blob>((resolve, reject) =>
        canvas1.toBlob(
          (blob) => blob ? resolve(blob) : reject(),
          mime, 1
        )
      ),
      new Promise<Blob>((resolve, reject) =>
        canvas2.toBlob(
          (blob) => blob ? resolve(blob) : reject(),
          mime, 1
        )
      ),
    ])

    this.book.splitPage(index, uuids)
    this.book.updatePageItemIndex()
    this.blobs.push(blobs, this.book.pageDirection === 'left' ? uuids : uuids.reverse())
    this.blobs.remove(pageItem.blobID)

    const list = toJS(this.contents.list)
    list.forEach(contentItem => {
      if (contentItem.pageIndex === null) {
        return
      }
      if (contentItem.pageIndex > index) {
        contentItem.pageIndex++
      }
    })

    this.contents.updateList(list)
  }

  insertBlankPage(index: number) {
    this.book.insertBlankPage(index)
    this.book.updatePageItemIndex()

    const selectedPageIndex = this.ui.selectedPageIndex
    if (selectedPageIndex !== null && (selectedPageIndex >= index)) {
      this.ui.selectPageIndex(selectedPageIndex + 1)
    }

    const list = toJS(this.contents.list)
    list.forEach(contentItem => {
      if (contentItem.pageIndex === null) {
        return
      }
      if (contentItem.pageIndex > index) {
        contentItem.pageIndex++
      }
    })

    this.contents.updateList(list)
  }

  removePage(index: number) {
    const pageItem = this.book.pages[index]
    if (pageItem && !pageItem.blank && pageItem.blobID) {
      this.blobs.remove(pageItem.blobID)
    }
    this.book.removePage(index)
    this.book.updatePageItemIndex()
    this.ui.selectPageIndex(null)

    const list = toJS(this.contents.list)
    list.forEach((contentItem) => {
      if (contentItem.pageIndex === null) {
        return
      }
      if (contentItem.pageIndex === index) {
        contentItem.pageIndex = null
        return
      }
      if (contentItem.pageIndex > index) {
        contentItem.pageIndex--
      }
    })

    this.contents.updateList(list)
  }

  async generateBook() {
    this.ui.setLoading(true, getLocale(this.ui.lang).loading.generating)
    try {
      await this.buildAndDownloadBook()
    } catch (err) {
      console.error('Failed to generate EPUB:', err)
      alert('Failed to generate EPUB\n' + err)
    } finally {
      this.ui.setLoading(false)
    }
  }

  private async buildAndDownloadBook() {
    let templateContainerXml = getTemplateContainerXml()
    let templatePageXhtml = getTemplatePageXhtml()
    let templatePageImgXhtml = getTemplatePageImgXhtml()
    let templateFixedLayoutJpCss = getTemplateFixedLayoutJpCss()
    let templateStandardOpf = getTemplateStandardOpf()
    let templateNavigationDocumentsXhtml = getTemplateNavigationDocumentsXhtml()

    const coverAlone = this.book.coverPosition === 'alone'
    const Zip = new JSZip()

    // The EPUB spec requires `mimetype` to be the FIRST entry in the archive,
    // stored without compression.
    Zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

    // In "alone" mode the cover is not part of the reading order, so content
    // page indices are shifted by one relative to book.pages.
    templateNavigationDocumentsXhtml = fillTemplate(
      templateNavigationDocumentsXhtml,
      '{{startPage}}',
      coverAlone ? 'p_0000.xhtml' : 'p_cover.xhtml'
    )
    templateNavigationDocumentsXhtml = fillTemplate(
      templateNavigationDocumentsXhtml,
      '<!-- navigation-list -->',
      Object.keys(this.contents.indexMap).map((pageIndex) => {
        const listIndex = this.contents.indexMap[pageIndex]
        const contentItem = this.contents.list[listIndex]
        const title = htmlToEscape(contentItem.title)

        if (!coverAlone && pageIndex === '0') {
          return `<li><a href="text/p_cover.xhtml">${title}</a></li>`
        }

        return `<li><a href="text/p_${getNumberStr(coverAlone ? +pageIndex : +pageIndex - 1, 4)}.xhtml">${title}</a></li>`
      }).join('\n')
    )

    let imageItemStr: string[] = []
    let pageItemStr: string[] = []
    let itemRefStr: string[] = []
    let spread = this.book.coverPosition === 'first-page'
      ? this.book.pageDirection
      : this.book.pageDirection === 'left'
        ? 'right'
        : 'left'

    this.book.pages.forEach((pageItem, i) => {
      const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
      const imageFileName = (i === 0 ? '' : 'i_') + numStr

      if (pageItem.blank) {
        pageItemStr.push(`<item id="p_${numStr}" href="text/p_${numStr}.xhtml" media-type="application/xhtml+xml" properties="svg"></item>`)
      } else {
        const mimeType = this.blobs.blobs[pageItem.blobID].blob.type // image/xxxxx
        pageItemStr.push(`<item id="p_${numStr}" href="text/p_${numStr}.xhtml" media-type="application/xhtml+xml" properties="svg" fallback="${imageFileName}"></item>`)
        imageItemStr.push(`<item id="${imageFileName}" href="image/${imageFileName}.${mimeType.slice(6)}" media-type="${mimeType}"${i === 0 ? ' properties="cover-image"' : ''}></item>`)
      }

      if (i !== 0) {
        itemRefStr.push(`<itemref linear="yes" idref="p_${numStr}" properties="page-spread-${spread}"></itemref>`)
        spread = spread === 'left' ? 'right' : 'left'
      }
    })

    if (coverAlone) {
      // The cover xhtml is neither in the manifest nor written to the archive;
      // only the cover image itself (properties="cover-image") is kept.
      pageItemStr.splice(0, 1)
    } else { // this.book.coverPosition === 'first-page'
      itemRefStr.unshift(`<itemref linear="yes" idref="p_cover" properties="rendition:page-spread-center"></itemref>`)
    }

    const viewPortWidth = this.book.pageSize[0] + ''
    const viewPortHeight = this.book.pageSize[1] + ''
    const fitMode = this.book.pageFit
    const bookTitle = htmlToEscape(this.book.bookTitle.trim())

    if (this.book.imgTag === 'svg') {
      this.book.pages.forEach((pageItem, i) => {
        const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)

        if (pageItem.blank) {
          if (i === 0 && coverAlone) {
            return
          }
          Zip.file(
            `OEBPS/text/p_${numStr}.xhtml`,
            fillTemplate(templatePageXhtml, '{{title}}', bookTitle)
              .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
              .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
              .replace('{{image}}', '')
          )
          return
        }

        const blob = this.blobs.blobs[pageItem.blobID].blob
        const ext = blob.type.slice(6)
        const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + ext

        Zip.file(`OEBPS/image/${imageFileName}`, blob)

        if (i === 0 && coverAlone) {
          // standalone cover: image only, no xhtml page
          return
        }

        let par = 'none'
        if (fitMode !== 'stretch') {
          par = this.book.pagePosition === 'center'
            ? 'xMidYMid '
            : this.book.pageDirection === 'left'
              ? (i + 1) % 2 === 1 ? 'xMaxYMid ' : 'xMinYMid '
              : (i + 1) % 2 === 1 ? 'xMinYMid ' : 'xMaxYMid '

          if (fitMode === 'fit') {
            par += 'meet'
          } else { // props.imageFit === 'fill'
            par += 'slice'
          }
        }

        Zip.file(
          `OEBPS/text/p_${numStr}.xhtml`,
          fillTemplate(templatePageXhtml, '{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
            .replace('{{image}}', `<image width="100%" height="100%" preserveAspectRatio="${par}" xlink:href="../image/${imageFileName}" />`)
        )
      })
    } else { // this.book.imgTag === 'img'
      this.book.pages.forEach((pageItem, i) => {
        const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)

        if (pageItem.blank) {
          if (i === 0 && coverAlone) {
            return
          }
          Zip.file(
            `OEBPS/text/p_${numStr}.xhtml`,
            fillTemplate(templatePageImgXhtml, '{{title}}', bookTitle)
              .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
              .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
              .replace(`<img src="{{imageSource}}" style="{{style}}"/>`, '<div style="width:100%;height:100%;"></div>')
          )
          return
        }

        const blob = this.blobs.blobs[pageItem.blobID].blob
        const ext = blob.type.slice(6)
        const imageFileName = (i === 0 ? '' : 'i_') + numStr + '.' + ext

        Zip.file(`OEBPS/image/${imageFileName}`, blob)

        if (i === 0 && coverAlone) {
          // standalone cover: image only, no xhtml page
          return
        }

        let imgStyle = 'object-fit:fill'
        if (fitMode !== 'stretch') {
          imgStyle = 'object-position:'

          imgStyle += (
            this.book.pagePosition === 'center'
              ? 'center;'
              : this.book.pageDirection === 'left'
                ? (i + 1) % 2 === 1 ? 'right;' : 'left;'
                : (i + 1) % 2 === 1 ? 'left;' : 'right;'
          )

          if (fitMode === 'fit') {
            imgStyle += 'object-fit:contain'
          } else { // props.imageFit === 'fill'
            imgStyle += 'object-fit:cover'
          }
        }

        Zip.file(
          `OEBPS/text/p_${numStr}.xhtml`,
          fillTemplate(templatePageImgXhtml, '{{title}}', bookTitle)
            .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
            .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
            .replace('{{imageSource}}', `../image/${imageFileName}`)
            .replace('{{style}}', imgStyle)
        )
      })
    }

    let authorsStr = this.book.bookAuthors.map((name, i) => {
      return [
        `<dc:creator id="creator${i + 1}">${htmlToEscape(name)}</dc:creator>`,
        `<meta refines="#creator${i + 1}" property="role" scheme="marc:relators">aut</meta>`,
        `<meta refines="#creator${i + 1}" property="file-as"></meta>`,
        `<meta refines="#creator${i + 1}" property="display-seq">${i + 1}</meta>`
      ].join('\n')
    }).join('\n')

    templateStandardOpf = templateStandardOpf
      .replace('{{uuid}}', () => htmlToEscape(this.book.bookID))
      .replace('{{title}}', () => bookTitle)
      .replace('<!-- creator-list -->', () => authorsStr)
      .replace('{{subject}}', () => htmlToEscape(this.book.bookSubject))
      .replace('{{publisher}}', () => htmlToEscape(this.book.bookPublisher))
      .replace('{{spread}}', this.book.pageShow === 'one' ? 'none' : 'landscape')
      .replace('{{createTime}}', new Date().toISOString())
      .replace(new RegExp('{{width}}', 'gm'), viewPortWidth)
      .replace(new RegExp('{{height}}', 'gm'), viewPortHeight)
      .replace('<!-- item-image -->', () => imageItemStr.join('\n'))
      .replace('<!-- item-xhtml -->', () => pageItemStr.join('\n'))
      .replace('<!-- itemref-xhtml -->', () => itemRefStr.join('\n'))
      .replace('{{direction}}', this.book.pageDirection === 'right' ? ' page-progression-direction="rtl"' : '')

    Zip.file('META-INF/container.xml', templateContainerXml)
    Zip.file('OEBPS/style/fixed-layout-jp.css', templateFixedLayoutJpCss)
    Zip.file('OEBPS/navigation-documents.xhtml', templateNavigationDocumentsXhtml)
    Zip.file('OEBPS/standard.opf', templateStandardOpf)

    const blob = await Zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE' // per-file STORE option on `mimetype` still applies
    })

    const anchor = document.createElement('a')
    const objectURL = window.URL.createObjectURL(blob)
    anchor.download = (this.book.bookTitle.trim() || 'untitled') + '.epub'
    anchor.href = objectURL
    anchor.click()
    window.URL.revokeObjectURL(objectURL)
  }
}

const store = new Store()

autorun(() => {
  localStorage.setItem('EPUB_CREATOR_SAVED_SETS_BOOK', JSON.stringify(toJS(store.book.savedSets)))
  localStorage.setItem('EPUB_CREATOR_SAVED_SETS_CONTENTS', JSON.stringify(toJS(store.contents.savedSets)))
})

// ---- workspace auto-save (IndexedDB) ----

interface WorkspaceSnapshot {
  pages: StoreBook.PageItem[]
  bookInfo: StoreBook.BookInfoSet & { bookID: string }
  pageSettings: {
    pageSize: [number, number]
    pagePosition: Book['pagePosition']
    pageShow: Book['pageShow']
    pageFit: Book['pageFit']
    pageBackgroundColor: Book['pageBackgroundColor']
    pageDirection: Book['pageDirection']
    coverPosition: Book['coverPosition']
    imgTag: Book['imgTag']
  }
  contents: { list: Contents['list'] }
  savedAt: number
}

const syncWorkspaceToDB = async (snapshot: WorkspaceSnapshot) => {
  try {
    await db.saveMetadata('active_book', snapshot)

    const referenced = new Set(
      snapshot.pages.filter(page => !page.blank && page.blobID).map(page => page.blobID)
    )

    // persist blobs that aren't saved yet
    for (const id of Array.from(referenced)) {
      if (!store.savedBlobIDs.has(id)) {
        const item = store.blobs.blobs[id]
        if (item) {
          await db.saveBlob(id, item.blob)
          store.savedBlobIDs.add(id)
        }
      }
    }

    // drop blobs that are no longer referenced by any page
    for (const id of Array.from(store.savedBlobIDs)) {
      if (!referenced.has(id)) {
        await db.deleteBlob(id)
        store.savedBlobIDs.delete(id)
      }
    }
  } catch (err) {
    console.error('Auto-save failed:', err)
  }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

autorun(() => {
  if (!store.isAutoSaveActive) {
    return
  }

  // subscribe to blob additions too, so blobs finished formatting after the
  // pages were pushed still get persisted
  void Object.keys(store.blobs.blobs).length

  const snapshot: WorkspaceSnapshot = {
    pages: toJS(store.book.pages),
    bookInfo: {
      bookID: store.book.bookID,
      bookTitle: store.book.bookTitle,
      bookAuthors: toJS(store.book.bookAuthors),
      bookSubject: store.book.bookSubject,
      bookPublisher: store.book.bookPublisher,
    },
    pageSettings: {
      pageSize: toJS(store.book.pageSize),
      pagePosition: store.book.pagePosition,
      pageShow: store.book.pageShow,
      pageFit: store.book.pageFit,
      pageBackgroundColor: store.book.pageBackgroundColor,
      pageDirection: store.book.pageDirection,
      coverPosition: store.book.coverPosition,
      imgTag: store.book.imgTag,
    },
    contents: { list: toJS(store.contents.list) },
    savedAt: Date.now(),
  }

  if (autoSaveTimer !== null) {
    clearTimeout(autoSaveTimer)
  }
  autoSaveTimer = setTimeout(() => syncWorkspaceToDB(snapshot), 800)
})

export const StoreContext = React.createContext(store);
export const useStore = () => React.useContext(StoreContext);
export default store;
