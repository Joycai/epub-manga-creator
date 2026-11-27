import { makeAutoObservable, toJS } from "mobx"
import uuid from 'utils/get-uuid'
import type { PageSticky } from 'utils/epub'

export declare namespace StoreBook {
  export interface PageItem {
    index: number,
    blobID: string
    sticky: PageSticky,
    blank: boolean
  }

  export interface BookInfoSet {
    bookTitle: string
    bookAuthors: string[]
    bookSubject: string
    bookPublisher: string
    bookLanguage?: string
  }
}

type BookPageProperty = 'bookID' | 'bookTitle' | 'bookAuthors' | 'bookSubject' | 'bookPublisher' | 'bookLanguage' | 'pageSize' | 'pagePosition' | 'pageShow' | 'pageFit' | 'pageBackgroundColor' | 'pageDirection' | 'coverPosition' | 'imgTag'

class Store {
  bookID: string = uuid()
  bookTitle: string = ''
  bookAuthors: string[] = ['']
  bookSubject: string = ''
  bookPublisher: string = ''
  bookLanguage: string = 'ja'

  pageSize: [number, number] = [880, 1250]
  hasCustomPageSize: boolean = false
  pagePosition: ('center' | 'between') = 'between'
  pageShow: ('two' | 'one') = 'two'
  pageFit: ('stretch' | 'fit' | 'fill') = 'stretch'
  pageBackgroundColor: ('white' | 'black') = 'white'
  pageDirection: ('right' | 'left') = 'right'
  coverPosition: ('first-page' | 'alone') = 'first-page'
  imgTag: ('svg' | 'img') = 'svg'

  pages: StoreBook.PageItem[] = []
  savedSets: StoreBook.BookInfoSet[] = []

  constructor() {
    makeAutoObservable(this)
  }

  pushNewPage(blobUUIDs: string[]) {
    const startIndex = this.pages.length
    const newPages: StoreBook.PageItem[] = blobUUIDs.map((uuid, index) => ({
      index: startIndex + index,
      blobID: uuid,
      sticky: 'auto',
      blank: false
    }))
    this.pages.push(...newPages);
  }

  splitPage(index: number, blobUUIDs: string[]) {
    const newPageItem1: StoreBook.PageItem = {
      index,
      blobID: blobUUIDs[0],
      sticky: 'auto',
      blank: false
    }
    const newPageItem2: StoreBook.PageItem = {
      index: -1,
      blobID: blobUUIDs[1],
      sticky: 'auto',
      blank: false
    }

    this.pages.splice(index, 1, newPageItem1, newPageItem2)
  }

  updateBookPageProperty<K extends BookPageProperty>(key: K, value: Store[K]) {
    (this as any)[key] = value
    if (key === 'pageSize') {
      this.hasCustomPageSize = true
    }
  }

  setPageSticky(index: number, sticky: StoreBook.PageItem['sticky']) {
    if (this.pages[index]) {
      this.pages[index].sticky = sticky
    }
  }

  removePage(index: number) {
    this.pages.splice(index, 1)
  }

  switchIndex(index: number, targetIndex: number) {
    const pageItem = this.pages[index];
    if (pageItem) {
      this.pages.splice(index, 1);
      this.pages.splice(targetIndex, 0, pageItem);
    }
  }

  updatePageItemIndex() {
    this.pages.forEach((pageItem, i) => {
      pageItem.index = i;
    });
  }

  insertBlankPage(index: number) {
    const newPageItem: StoreBook.PageItem = {
      index: -1,
      blobID: '',
      sticky: 'auto',
      blank: true
    }

    if (index >= this.pages.length) {
      this.pages.push(newPageItem)
    } else {
      const currentIndex = index < 0 ? 0 : index
      this.pages.splice(currentIndex, 0, newPageItem)
    }
  }

  saveBookInfoToSet() {
    const newSet: StoreBook.BookInfoSet = {
      bookTitle: this.bookTitle,
      bookAuthors: toJS(this.bookAuthors), // Keep toJS here for deep copy
      bookSubject: this.bookSubject,
      bookPublisher: this.bookPublisher,
      bookLanguage: this.bookLanguage,
    }

    this.savedSets.push(newSet)
  }

  removeBookInfoSet(index: number) {
    this.savedSets.splice(index, 1)
  }

  reset() {
    this.bookID = uuid()
    this.bookTitle = ''
    this.bookAuthors = ['']
    this.bookSubject = ''
    this.bookPublisher = ''
    this.bookLanguage = 'ja'
    this.hasCustomPageSize = false
    this.pages = []
  }

  applySet(index: number) {
    const selectedSet = this.savedSets[index];
    if (selectedSet) {
      this.bookTitle = selectedSet.bookTitle
      this.bookAuthors = toJS(selectedSet.bookAuthors) // Keep toJS here to avoid assigning observable to observable
      this.bookSubject = selectedSet.bookSubject
      this.bookPublisher = selectedSet.bookPublisher
      this.bookLanguage = selectedSet.bookLanguage || 'ja'
    }
  }
}

export default Store