import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useState } from 'react'
import storeMain, { useStore } from 'store/main'
import storeBlobs, { StoreBlobs } from 'store/blobs'
import Icon from './icon'
import { useI18n } from 'i18n'
import { db } from 'utils/db'
import { computePageSlots, getSvgPreserveAspectRatio, PageSticky } from 'utils/epub'

const THIS_YEAR = (new Date()).getFullYear()

const STICKY_BADGE_MAP: Partial<Record<PageSticky, string>> = {
  center: 'C',
  left: 'L',
  right: 'R',
}

const PageCard = observer(function(props: {
  pageItemIndex: number | null
  // Number shown on the card. Display only — never use it to address storeBook.pages.
  pageNumber?: number | null
  blobItem?: StoreBlobs.ImageBlob | null
  align: 'center' | 'left' | 'right'
  blank: boolean
  sticky?: PageSticky
}) {
  const { ui: storeUI, book: storeBook, contents: storeContent } = useStore()
  const t = useI18n()

  const onClickImage = useCallback(() => {
    storeMain.ui.selectPageIndex(props.pageItemIndex)
  }, [props.pageItemIndex])

  if (props.pageItemIndex === null) {
    return (
      <div className="card"><div className="card-image"></div></div>
    )
  }

  const preserveAspectRatio = getSvgPreserveAspectRatio(storeBook.pageFit, props.align)
  const stickyBadge = props.sticky ? STICKY_BADGE_MAP[props.sticky] : undefined
  const imageFocus = props.pageItemIndex !== null && (storeUI.selectedPageIndex === props.pageItemIndex)

  return (
    <div className="card">
      {
        props.pageItemIndex in storeContent.indexMap
          ? <div className="bookmark-ribbon" title={storeContent.list[storeContent.indexMap[props.pageItemIndex]].title} />
          : null
      }
      {
        stickyBadge ? <div className="spread-badge">{stickyBadge}</div> : null
      }
      {
        props.pageItemIndex !== null && (props.blobItem || props.blank) && (
          <button
            type="button"
            className="zoom-btn"
            title={t.main.zoomPreview}
            onClick={(e) => {
              e.stopPropagation()
              storeMain.ui.openPreview(props.pageItemIndex as number)
            }}
          >
            <Icon name="zoom" />
          </button>
        )
      }
      {
        (props.blobItem || (!props.blobItem && props.blank)) ? (
          <svg
            className="card-image"
            viewBox={'0 0 ' + storeBook.pageSize.join(' ')} onClick={onClickImage}
          >
            <rect x="0" y="0" width="100%" height="100%" fill={storeBook.pageBackgroundColor === 'white' ? '#fff' : '#000'}/>
            {
              props.blobItem ? (
                <image
                  width="100%"
                  height="100%"
                  preserveAspectRatio={preserveAspectRatio}
                  xlinkHref={props.blobItem.thumbnailURL}
                />
              ) : null
            }
            {
              !imageFocus ? null :
                <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="rgba(49,132,253,.5)" strokeWidth="8%"/>
            }
          </svg>
        ) : (
          <div className="card-image">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        )
      }
      {
        props.pageItemIndex === null
          ? null
          : <div className="page-num">{(props.pageNumber ?? props.pageItemIndex) + 1}</div>
      }
    </div>
  )
})

interface SpreadItem {
  left: number | null
  right: number | null
  center: number | null
}

const DoublePageCard = observer(function(props: {
  spread: SpreadItem
}) {
  const { book: storeBook } = useStore()
  const { left: leftSidePageIndex, right: rightSidePageIndex, center: centerPageIndex } = props.spread
  // With a standalone cover, page 0 is the cover and the body is numbered from 1.
  // This offset shifts the *label* only — pageItemIndex must stay the real index in
  // storeBook.pages, since selection / preview / remove / TOC all address pages by it.
  const isStandaloneCover = storeBook.coverPosition === 'alone' && storeBook.pages.length > 1
  const pageNumberOffset = isStandaloneCover ? -1 : 0
  const useBetweenAlign = storeBook.pageShow === 'two' && storeBook.pagePosition === 'between'

  if (centerPageIndex !== null) {
    const centerPage = storeBook.pages[centerPageIndex]
    return (
      <div className="card-group card-group-center">
        <PageCard
          pageItemIndex={centerPageIndex}
          pageNumber={centerPageIndex + pageNumberOffset}
          blobItem={centerPage ? storeBlobs.blobs[centerPage.blobID] : null}
          align="center"
          blank={centerPage?.blank || false}
          sticky={centerPageIndex === 0 && isStandaloneCover ? undefined : centerPage?.sticky}
        />
      </div>
    )
  }

  const leftSidePage = leftSidePageIndex === null ? null : storeBook.pages[leftSidePageIndex]
  const rightSidePage = rightSidePageIndex === null ? null : storeBook.pages[rightSidePageIndex]

  return (
    <div className="card-group">
      <PageCard
        pageItemIndex={leftSidePageIndex}
        pageNumber={leftSidePageIndex === null ? null : (leftSidePageIndex + pageNumberOffset)}
        blobItem={leftSidePage ? storeBlobs.blobs[leftSidePage.blobID] : null}
        align={useBetweenAlign ? 'right' : 'center'}
        blank={leftSidePage?.blank || false}
        sticky={leftSidePageIndex === 0 && isStandaloneCover ? undefined : leftSidePage?.sticky}
      />
      <div className="book-spine" />
      <PageCard
        pageItemIndex={rightSidePageIndex}
        pageNumber={rightSidePageIndex === null ? null : (rightSidePageIndex + pageNumberOffset)}
        blobItem={rightSidePage ? storeBlobs.blobs[rightSidePage.blobID] : null}
        align={useBetweenAlign ? 'left' : 'center'}
        blank={rightSidePage?.blank || false}
        sticky={rightSidePageIndex === 0 && isStandaloneCover ? undefined : rightSidePage?.sticky}
      />
    </div>
  )
})

const RestoreBanner = observer(function() {
  const t = useI18n()
  const [hasBackup, setHasBackup] = useState(false)

  useEffect(() => {
    db.getMetadata('active_book').then((backup) => {
      if (backup && backup.pages && backup.pages.length > 0) {
        setHasBackup(true)
      } else {
        storeMain.setAutoSaveActive(true)
      }
    }).catch(err => {
      console.error('Failed to read backup from DB:', err)
      storeMain.setAutoSaveActive(true)
    })
  }, [])

  const onRestore = useCallback(() => {
    storeMain.restoreWorkspace().then(() => {
      setHasBackup(false)
      storeMain.setAutoSaveActive(true)
    })
  }, [])

  const onDismiss = useCallback(() => {
    db.clearAll().then(() => {
      setHasBackup(false)
      storeMain.setAutoSaveActive(true)
    }).catch(err => {
      console.error('Failed to clear backup:', err)
      setHasBackup(false)
      storeMain.setAutoSaveActive(true)
    })
  }, [])

  if (!hasBackup || storeMain.isAutoSaveActive) return null

  return (
    <div className="alert alert-info d-flex justify-content-between align-items-center" role="alert">
      <span>{t.main.restoreDetected}</span>
      <div>
        <button className="btn btn-sm btn-primary me-2" onClick={onRestore}>
          {t.main.restore}
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={onDismiss}>
          {t.main.dismiss}
        </button>
      </div>
    </div>
  )
})

// Pair pages into visual spreads matching computePageSlots and reading direction.
const buildSpreads = function(
  pages: { sticky?: PageSticky }[],
  coverPosition: 'first-page' | 'alone',
  pageDirection: 'right' | 'left',
): SpreadItem[] {
  const spreads: SpreadItem[] = []
  if (pages.length === 0) {
    return spreads
  }

  const slots = computePageSlots(pages, coverPosition, pageDirection)
  const firstSlot: 'left' | 'right' = pageDirection === 'right' ? 'right' : 'left'
  const secondSlot: 'left' | 'right' = firstSlot === 'right' ? 'left' : 'right'

  let pending: { left: number | null; right: number | null } | null = null
  const flushPending = () => {
    if (pending) {
      spreads.push({ left: pending.left, right: pending.right, center: null })
      pending = null
    }
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]

    if (slot === 'none') {
      // Standalone cover is shown in the first preview spread alongside page 1.
      pending = { left: null, right: null }
      pending[firstSlot] = i
    } else if (slot === 'center') {
      flushPending()
      spreads.push({ left: null, right: null, center: i })
    } else if (slot === firstSlot) {
      flushPending()
      pending = { left: null, right: null }
      pending[firstSlot] = i
    } else if (pending && pending[secondSlot] === null) {
      pending[secondSlot] = i
      flushPending()
    } else {
      flushPending()
      spreads.push({
        left: slot === 'left' ? i : null,
        right: slot === 'right' ? i : null,
        center: null,
      })
    }
  }

  flushPending()
  return spreads
}

const Main = function() {
  const { book: storeBook } = useStore()
  const t = useI18n()

  const spreads = buildSpreads(storeBook.pages, storeBook.coverPosition, storeBook.pageDirection)

  const onClickImport = useCallback(() => {
    document.getElementById('input-upload')?.click()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (storeMain.ui.isPreviewOpen) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          storeMain.ui.prevPreviewPage()
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          storeMain.ui.nextPreviewPage(storeBook.pages.length)
        } else if (e.code === 'Escape' || e.code === 'Space') {
          e.preventDefault()
          storeMain.ui.closePreview()
        }
        return
      }

      if (storeMain.ui.selectedPageIndex !== null) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          storeMain.ui.openPreview(storeMain.ui.selectedPageIndex)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [storeBook.pages.length])

  return (
    <main id="main" className="pt-4 pb-4">
      <RestoreBanner />
      {
        spreads.length === 0 ? (
          import.meta.env.DEV
            ? <div className="btn btn-secondary main-input-upload" onClick={onClickImport}>{t.main.import}</div>
            : <div className="alert alert-secondary text-center" role="alert">{t.main.ready}</div>
        ) : (
          // One wrapping container for every spread. Chunking into fixed-width rows
          // in JS meant guessing the wrap point, and a wrong guess let the browser
          // wrap a "row" again — that's the 8-then-2 interleaving. Right-to-left
          // reading order is a CSS concern too (row-reverse), so it survives wrapping.
          <div
            className={
              'row page-row justify-content-evenly'
              + (storeBook.pageDirection === 'right' ? ' page-row-rtl' : '')
            }
          >
            {
              spreads.map((spread, i) => (<DoublePageCard key={`${i}-${spread.left}-${spread.right}-${spread.center}`} spread={spread}/>))
            }
          </div>
        )
      }
      <div className="author-info">
        <div>{THIS_YEAR} Joycai@Github</div>
        <iframe
          title="ghbtns"
          className="ghbtns"
          src="https://ghbtns.com/github-btn.html?user=Joycai&amp;repo=epub-manga-creator&amp;type=star&amp;count=true"
          frameBorder="0"
          scrolling="0"
          width="80px"
          height="20px"
        />
      </div>
    </main>
  )
}

export default observer(Main)