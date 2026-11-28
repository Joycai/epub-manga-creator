import React from 'react';
import { autorun, makeAutoObservable, runInAction, toJS } from "mobx"
import uuid from 'utils/get-uuid'
import Book, { StoreBook } from 'store/book'
import Ui from 'store/ui'
import Contents from 'store/contents'
import storeBlobs, { Store as Blobs, StoreBlobs } from 'store/blobs'
import { db } from 'utils/db'
import { getLocale } from 'i18n'
import {
  buildEpubZip,
  detectImageMimeFromBytes,
  EpubPageInput,
  isEpub33CoreImageMime,
} from 'utils/epub'

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(blob => resolve(blob), type, quality))

const ensureCoreMediaImage = async (
  blobItem: StoreBlobs.ImageBlob,
): Promise<{ data: Blob; mimeType: string }> => {
  const header = new Uint8Array(await blobItem.blob.slice(0, 16).arrayBuffer())
  const sniffed = detectImageMimeFromBytes(header)
  const mimeType = sniffed || (blobItem.blob.type || '').toLowerCase()

  if (mimeType && isEpub33CoreImageMime(mimeType)) {
    return { data: blobItem.blob, mimeType }
  }

  // Transcode foreign image formats (e.g. AVIF) to an EPUB 3.3 Core Media Type.
  const img = blobItem.originImage
  const canvas = document.createElement('canvas')
  try {
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to create 2D canvas context for image transcoding')
    }
    ctx.drawImage(img, 0, 0)

    let converted = await canvasToBlob(canvas, 'image/webp', 0.92)
    if (!converted || !isEpub33CoreImageMime(converted.type)) {
      converted = await canvasToBlob(canvas, 'image/png')
    }
    if (!converted) {
      throw new Error(`Failed to transcode image (${mimeType || 'unknown'}) to an EPUB 3.3 Core Media Type`)
    }

    return {
      data: converted,
      mimeType: isEpub33CoreImageMime(converted.type) ? converted.type : 'image/png',
    }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
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
        .map((page, i) => ({ ...page, sticky: page.sticky || 'auto', index: i }))

      if (backup.bookInfo) {
        this.book.bookID = backup.bookInfo.bookID || this.book.bookID
        this.book.bookTitle = backup.bookInfo.bookTitle || ''
        this.book.bookAuthors = backup.bookInfo.bookAuthors?.length ? backup.bookInfo.bookAuthors : ['']
        this.book.bookSubject = backup.bookInfo.bookSubject || ''
        this.book.bookPublisher = backup.bookInfo.bookPublisher || ''
        this.book.bookLanguage = backup.bookInfo.bookLanguage || 'ja'
      }

      if (backup.pageSettings) {
        const s = backup.pageSettings
        if (Array.isArray(s.pageSize)) {
          this.book.pageSize = s.pageSize
          this.book.hasCustomPageSize = true
        }
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

  async importPageFromImages(fileList: File[]) {
    const uuids = fileList.map(() => uuid())

    this.book.pushNewPage(uuids)
    await this.blobs.push(fileList, uuids)

    if (!this.book.hasCustomPageSize && uuids.length > 0) {
      const firstBlob = this.blobs.blobs[uuids[0]]
      const img = firstBlob?.originImage
      const width = img ? (img.naturalWidth || img.width) : 0
      const height = img ? (img.naturalHeight || img.height) : 0
      if (width > 0 && height > 0) {
        runInAction(() => {
          if (!this.book.hasCustomPageSize) {
            this.book.pageSize = [width, height]
            this.book.hasCustomPageSize = true
          }
        })
      }
    }
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
    const pages: EpubPageInput[] = []
    for (let i = 0; i < this.book.pages.length; i++) {
      const pageItem = this.book.pages[i]
      if (pageItem.blank) {
        pages.push({ blank: true, sticky: pageItem.sticky })
        continue
      }
      const blobItem = this.blobs.blobs[pageItem.blobID]
      if (!blobItem) {
        throw new Error(`Missing image blob for page ${i + 1}`)
      }
      const image = await ensureCoreMediaImage(blobItem)
      pages.push({
        blank: false,
        sticky: pageItem.sticky,
        image,
      })
    }

    const tocEntries = Object.keys(this.contents.indexMap).map((pageIndex) => {
      const listIndex = this.contents.indexMap[pageIndex]
      const contentItem = this.contents.list[listIndex]
      return {
        pageIndex: +pageIndex,
        title: contentItem?.title || '',
      }
    })

    const Zip = buildEpubZip({
      bookID: this.book.bookID,
      fallbackUuid: uuid(),
      bookTitle: this.book.bookTitle,
      bookAuthors: toJS(this.book.bookAuthors),
      bookSubject: this.book.bookSubject,
      bookPublisher: this.book.bookPublisher,
      bookLanguage: this.book.bookLanguage,
      pageSize: toJS(this.book.pageSize),
      pagePosition: this.book.pagePosition,
      pageShow: this.book.pageShow,
      pageFit: this.book.pageFit,
      pageBackgroundColor: this.book.pageBackgroundColor,
      pageDirection: this.book.pageDirection,
      coverPosition: this.book.coverPosition,
      imgTag: this.book.imgTag,
      pages,
      tocEntries,
    })

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
      bookLanguage: store.book.bookLanguage,
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
