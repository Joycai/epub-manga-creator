import JSZip from 'jszip'
import { observer } from 'mobx-react'
import React, { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import Icon from 'components/icon'
import { StoreContext } from 'store/main'
import { useI18n } from 'i18n'
import { detectImageMimeFromBytes, PageSticky } from 'utils/epub'

type SupportType = 'image' | 'zip'

const PageControl = observer(function(props: { pageIndex: number | null }) {
  const storeMain = useContext(StoreContext);
  const t = useI18n();
  const onUseImageSizeToPage = useCallback(() => {
    const pageItem = storeMain.book.pages[props.pageIndex as number]
    const image = storeMain.blobs.blobs[pageItem.blobID].originImage
    storeMain.book.updateBookPageProperty('pageSize', [
      image.width,
      image.height
    ])
  }, [props.pageIndex, storeMain])

  const onChangePageIndex = useCallback(() => {
    const max = storeMain.book.pages.length
    const inputValue = window.prompt(t.prompt.newPageIndex(max))
    let num = parseInt(inputValue || '')
    
    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.replacePageIndex(props.pageIndex as number, num - 1)
  }, [props.pageIndex, storeMain, t])

  const onSetContentq = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    storeMain.contents.setPageIndexToTitle(
      +(e.currentTarget.dataset.index as string),
      props.pageIndex as number
    )
  }, [props.pageIndex, storeMain])

  const onSplitPage = useCallback(() => {
    storeMain.splitPage(props.pageIndex as number)
  }, [props.pageIndex, storeMain])

  const onSetPageSticky = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const sticky = e.currentTarget.dataset.sticky as PageSticky
    storeMain.book.setPageSticky(props.pageIndex as number, sticky)
  }, [props.pageIndex, storeMain])

  const onRemovePage = useCallback(() => {
    const res = window.confirm(t.prompt.removePage(props.pageIndex as number))
    res && storeMain.removePage(props.pageIndex as number)
  }, [props.pageIndex, storeMain, t])

  if (props.pageIndex === null) {
    return (
      <>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="ruler"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="menu"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="bookmark"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled title={t.page.spreadPosition}><Icon name="swap"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="scissors"/></button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled><Icon name="cross"/></button>
        </div>
      </>
    )
  }

  const currentPage = storeMain.book.pages[props.pageIndex]
  const blankPage = currentPage.blank
  const currentSticky = currentPage.sticky
  const isStandaloneCover = props.pageIndex === 0 && storeMain.book.coverPosition === 'alone' && storeMain.book.pages.length > 1
  const stickyOptions: { value: PageSticky; label: string }[] = [
    { value: 'auto', label: t.option.auto },
    { value: 'center', label: t.option.spreadCenter },
    { value: 'left', label: t.option.spreadLeft },
    { value: 'right', label: t.option.spreadRight },
  ]

  return (
    <>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={blankPage} onClick={onUseImageSizeToPage}>
            <Icon name="ruler"/>
          </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onChangePageIndex}>
            <Icon name="menu"/>
          </button>
      </div>
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-secondary"><Icon name="bookmark"/></button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          {
            storeMain.contents.list.map((contentItem, index) =>
              <li key={index}>
                <span
                  className={"dropdown-item" + (contentItem.pageIndex === props.pageIndex ? ' active' : '')}
                  data-index={index}
                  onClick={onSetContentq}
                >
                  {contentItem.title}
                </span>
              </li>
            )
          }
        </ul>
      </div>
      {
        isStandaloneCover ? (
          <div className="nav-item">
            <button type="button" className="btn btn-outline-secondary disabled" disabled title={t.page.spreadPosition}><Icon name="swap"/></button>
          </div>
        ) : (
          <div className="nav-item dropdown">
            <button type="button" className="btn btn-secondary" title={t.page.spreadPosition}><Icon name="swap"/></button>
            <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
              {
                stickyOptions.map((opt) =>
                  <li key={opt.value}>
                    <span
                      className={"dropdown-item" + (currentSticky === opt.value ? ' active' : '')}
                      data-sticky={opt.value}
                      onClick={onSetPageSticky}
                    >
                      {opt.label}
                    </span>
                  </li>
                )
              }
            </ul>
          </div>
        )
      }
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={blankPage} onClick={onSplitPage}>
          <Icon name="scissors"/>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={onRemovePage}>
          <Icon name="cross"/>
        </button>
      </div>
    </>
  )
})

const AcceptMap = {
  image: 'image/jpeg,image/png,image/gif,image/webp,image/avif,.jpg,.jpeg,.png,.gif,.webp,.avif',
  zip: 'application/zip,.zip',
}

const MultipleAttrMap = {
  image: true,
  zip: false,
}

const blobToFile = (theBlob: Blob, fileName:string): File => {
  var b: any = theBlob
  b.lastModifiedDate = new Date()
  b.name = fileName
  return theBlob as File
}

const Header = function() {
  const storeMain = useContext(StoreContext);
  const { ui, book } = storeMain;
  const t = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputType, setInputType] = useState<SupportType>('zip')

  const onClickToggleBookVisible = useCallback(() => {
    ui.toggleBookVisible()
  }, [ui])
  const onClickToggleContentVisible = useCallback(() => {
    ui.toggleContentVisible()
  }, [ui])
  const onClickTogglePageVisible = useCallback(() => {
    ui.togglePageVisible()
  }, [ui])

  const onClickImport = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const newType = e.currentTarget.dataset.type as SupportType

    if (newType === inputType) {
      inputRef.current?.click()
    } else {
      setInputType(newType)
    }
  }, [inputType])

  const handleGetFile = useCallback(async () => {
    const input: HTMLInputElement = inputRef.current as HTMLInputElement

    if (inputType === 'zip' && (input?.files?.[0])) {
      const fileName = input.files[0].name 
      JSZip.loadAsync(input.files[0]).then(zipContent => {
        // natural sort so "10.jpg" comes after "2.jpg"
        const zipFiles = Object.keys(zipContent.files)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          .map((filename) => zipContent.files[filename])
        const promises: Promise<File | null>[] = zipFiles.map(zipItem => {
          if (zipItem.dir) {
            return Promise.resolve(null)
          }

          return new Promise(resolve => {
            zipItem.async('uint8array').then(uint8Array => {
              const mimeType = detectImageMimeFromBytes(new Uint8Array(uint8Array))

              if (mimeType) {
                const b = new Blob([new Uint8Array(uint8Array)], { type: mimeType })
                resolve(
                  blobToFile(
                    b,
                    zipItem.name.replace(/^.+\/(.+)$/, '$1')
                  )
                )
              } else {
                resolve(null)
              }
            })
          })
        })

        return Promise.all(promises) as Promise<File[]>
      }).then((files: (File | null)[]) => {
        storeMain.importPageFromImages(files.filter(b => b !== null) as File[])
        if (storeMain.ui.firstImport) {
          storeMain.ui.toggleBookVisible(fileName)
        }
      })
      return
    }

    storeMain.importPageFromImages(Array.from(input.files as FileList))
  }, [inputType, storeMain])

  const onClickInsertBlankPage = useCallback(() => {
    const max = book.pages.length
    const inputValue = window.prompt(t.prompt.insertPageIndex(max))
    let num = parseInt(inputValue || '')

    if (isNaN(num) || num < 1) {
      return
    } else if (num > max) {
      num = max
    }

    storeMain.insertBlankPage(num - 1)
  }, [book, storeMain, t])

  const onClickGenerate = useCallback(() => {
    storeMain.generateBook()
  }, [storeMain])

  const onCycleTheme = useCallback(() => {
    ui.cycleTheme()
  }, [ui])

  const onClickReset = useCallback(() => {
    if (window.confirm(t.confirm.reset)) {
      storeMain.resetWorkspace()
    }
  }, [storeMain, t])

  useLayoutEffect(() => {
    if (inputType) {
      inputRef.current?.click()
    }
  }, [inputType])

  return (
    <nav id="nav" className="navbar bg-dark">
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-primary">
          <Icon name="upload"/>
        </button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          <li><span className="dropdown-item" data-type="image" onClick={onClickImport}>{t.nav.importImage}</span></li>
          <li><span className="dropdown-item" data-type="zip" onClick={onClickImport}>{t.nav.importZip}</span></li>
        </ul>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleBookVisible}><Icon name="book"/></button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickToggleContentVisible}><Icon name="list"/></button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={onClickTogglePageVisible}><Icon name="tools"/></button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={book.pages.length === 0}
          onClick={onClickInsertBlankPage}
          title={t.nav.insertBlankPage}
        >
          <Icon name="notification"/>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={book.pages.length === 0}
          onClick={onClickGenerate}
          title={t.nav.generate}
        >
          <Icon name="install"/>
        </button>
      </div>
      <PageControl pageIndex={ui.selectedPageIndex}/>
      <div className="nav-item nav-bottom-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCycleTheme}
          title={
            { light: t.nav.themeLight, dark: t.nav.themeDark, auto: t.nav.themeAuto }[ui.theme]
          }
        >
          <Icon name={ui.theme === 'light' ? 'sun' : ui.theme === 'dark' ? 'moon' : 'theme-auto'}/>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary nav-reset-btn"
          disabled={book.pages.length === 0}
          onClick={onClickReset}
          title={t.nav.reset}
        >
          <Icon name="trash"/>
        </button>
      </div>
      <input
        key={inputType}
        id="input-upload"
        ref={inputRef}
        type="file"
        value=""
        accept={AcceptMap[inputType]}
        multiple={MultipleAttrMap[inputType]}
        onChange={handleGetFile}
        style={{display:"none"}}
      />
    </nav>
  )
}

export default observer(Header)