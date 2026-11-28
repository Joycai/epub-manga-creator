import JSZip from 'jszip'

import getTemplateContainerXml from 'template/container.xml'
import getTemplatePageXhtml from 'template/page.xhtml'
import getTemplatePageImgXhtml from 'template/page_img.xhtml'
import getTemplateFixedLayoutJpCss from 'template/fixed-layout-jp.css'
import getTemplateStandardOpf from 'template/standard.opf'
import getTemplateNavigationDocumentsXhtml from 'template/navigation-documents.xhtml'

export type PageSticky = 'auto' | 'center' | 'left' | 'right'
export type SpreadSlot = 'center' | 'left' | 'right' | 'none'
export type PageFit = 'stretch' | 'fit' | 'fill'
export type PagePosition = 'center' | 'between'
export type PageDirection = 'right' | 'left'
export type CoverPosition = 'first-page' | 'alone'

export const EPUB33_IMAGE_CORE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

/**
 * Strip characters forbidden by XML 1.0 and escape reserved markup characters.
 */
export const escapeXml = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF]/g, '')
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Format a timestamp as strict UTC CCYY-MM-DDThh:mm:ssZ without fractional seconds.
 */
export const formatEpubModifiedDate = (date: Date = new Date()): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z')

/**
 * Normalize a language input into a valid BCP 47 tag, falling back to "ja".
 */
export const normalizeLanguage = (lang: string): string => {
  const normalized = lang.trim().replace(/_/g, '-')
  if (/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(normalized)) {
    return normalized
  }
  return 'ja'
}

/**
 * Normalize a publication identifier into a valid EPUB identifier.
 */
export const formatIdentifier = (bookID: string, fallbackUuid: string): string => {
  const trimmed = bookID.trim()
  if (!trimmed) {
    return `urn:uuid:${fallbackUuid}`
  }
  if (/^(?:urn:|https?:\/\/)/i.test(trimmed)) {
    return trimmed
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return `urn:uuid:${trimmed}`
  }
  return trimmed
}

/**
 * Return whether the MIME type is an EPUB 3.3 Core Media Type image format.
 */
export const isEpub33CoreImageMime = (mime: string): boolean =>
  Object.prototype.hasOwnProperty.call(EPUB33_IMAGE_CORE_MIME_TO_EXT, mime.toLowerCase())

/**
 * Return the canonical file extension for an EPUB 3.3 Core Media Type image, or null.
 */
export const getImageExtension = (mime: string): string | null =>
  EPUB33_IMAGE_CORE_MIME_TO_EXT[mime.toLowerCase()] ?? null

/**
 * Sniff common raster image MIME types from leading magic bytes.
 */
export const detectImageMimeFromBytes = (bytes: Uint8Array): string | null => {
  const hexOf = (start: number, end: number) =>
    Array.from(bytes.subarray(start, end))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  const asciiOf = (start: number, end: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(start, end)))

  if (bytes.length >= 4 && hexOf(0, 4) === '89504e47') {
    return 'image/png'
  }
  if (bytes.length >= 3 && hexOf(0, 3) === 'ffd8ff') {
    return 'image/jpeg'
  }
  if (bytes.length >= 4 && asciiOf(0, 4) === 'GIF8') {
    return 'image/gif'
  }
  if (bytes.length >= 12 && asciiOf(0, 4) === 'RIFF' && asciiOf(8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (bytes.length >= 12 && asciiOf(4, 8) === 'ftyp' && ['avif', 'avis'].includes(asciiOf(8, 12))) {
    return 'image/avif'
  }
  return null
}

/**
 * Assign each page's EPUB spread slot from reading direction, cover mode, and sticky overrides.
 */
export const computePageSlots = (
  pages: { sticky?: PageSticky }[],
  coverPosition: CoverPosition,
  pageDirection: PageDirection,
): SpreadSlot[] => {
  if (pages.length === 0) {
    return []
  }

  // A 1-page book cannot omit page 0 from the spine or the spine would be empty.
  const effectiveCoverAlone = coverPosition === 'alone' && pages.length > 1
  const firstSlot: 'left' | 'right' = pageDirection === 'right' ? 'right' : 'left'
  const secondSlot: 'left' | 'right' = firstSlot === 'right' ? 'left' : 'right'
  const opposite = (slot: 'left' | 'right'): 'left' | 'right' => (slot === 'left' ? 'right' : 'left')

  const slots: SpreadSlot[] = new Array(pages.length)
  let nextSlot: 'left' | 'right' = effectiveCoverAlone ? secondSlot : firstSlot

  if (effectiveCoverAlone) {
    slots[0] = 'none'
  } else {
    const coverSticky = pages[0].sticky
    if (coverSticky === 'left' || coverSticky === 'right') {
      slots[0] = coverSticky
      nextSlot = opposite(coverSticky)
    } else {
      slots[0] = 'center'
      nextSlot = firstSlot
    }
  }

  for (let i = 1; i < pages.length; i++) {
    const sticky = pages[i].sticky
    if (sticky === 'center') {
      slots[i] = 'center'
      nextSlot = firstSlot
    } else if (sticky === 'left' || sticky === 'right') {
      slots[i] = sticky
      nextSlot = opposite(sticky)
    } else {
      slots[i] = nextSlot
      nextSlot = opposite(nextSlot)
    }
  }

  return slots
}

/**
 * Resolve horizontal image alignment inside a page slot so "between" hugs the inner spine.
 */
export const getPageAlignment = (
  slot: SpreadSlot,
  pagePosition: PagePosition,
): 'center' | 'left' | 'right' => {
  if (pagePosition === 'center' || slot === 'center' || slot === 'none') {
    return 'center'
  }
  // Left page has its spine on the right edge; right page has its spine on the left edge.
  return slot === 'left' ? 'right' : 'left'
}

/**
 * Compute SVG preserveAspectRatio for the given fit mode and horizontal alignment.
 */
export const getSvgPreserveAspectRatio = (
  fitMode: PageFit,
  align: 'center' | 'left' | 'right',
): string => {
  if (fitMode === 'stretch') {
    return 'none'
  }
  const xAlign = align === 'center' ? 'xMidYMid' : align === 'left' ? 'xMinYMid' : 'xMaxYMid'
  return `${xAlign} ${fitMode === 'fit' ? 'meet' : 'slice'}`
}

/**
 * Compute CSS object-fit/object-position declarations for an <img> page.
 */
export const getImgInlineStyle = (
  fitMode: PageFit,
  align: 'center' | 'left' | 'right',
): string => {
  if (fitMode === 'stretch') {
    return 'object-fit:fill;'
  }
  return `object-position:${align};object-fit:${fitMode === 'fit' ? 'contain' : 'cover'};`
}

const getNumberStr = (num: number, zeroCount: number): string => {
  let str = String(num)
  let i = zeroCount - str.length
  while (i-- > 0) {
    str = '0' + str
  }
  return str
}

// Callback replacement avoids `$&` / `$'` interpolation in user strings.
const fillTemplate = (template: string, pattern: string | RegExp, value: string): string =>
  template.replace(pattern, () => value)

export interface EpubPageInput {
  blank: boolean
  sticky?: PageSticky
  image?: {
    data: Blob | Uint8Array
    mimeType: string
  }
}

export interface EpubTocEntry {
  pageIndex: number
  title: string
}

export interface BuildEpubInput {
  bookID: string
  fallbackUuid: string
  bookTitle: string
  bookAuthors: string[]
  bookSubject: string
  bookPublisher: string
  bookLanguage: string
  pageSize: [number, number]
  pagePosition: PagePosition
  pageShow: 'two' | 'one'
  pageFit: PageFit
  pageBackgroundColor: 'white' | 'black'
  pageDirection: PageDirection
  coverPosition: CoverPosition
  imgTag: 'svg' | 'img'
  pages: EpubPageInput[]
  tocEntries: EpubTocEntry[]
  now?: Date
}

/**
 * Assemble an EPUB 3.3 fixed-layout manga archive in memory.
 */
export const buildEpubZip = (input: BuildEpubInput): JSZip => {
  if (input.pages.length === 0) {
    throw new Error('Cannot generate EPUB with zero pages')
  }

  const Zip = new JSZip()

  // EPUB OCF 3.3 requires `mimetype` first, uncompressed (STORE), with no extra fields.
  Zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  const langRaw = normalizeLanguage(input.bookLanguage || 'ja')
  const lang = escapeXml(langRaw)
  const rawTitle = input.bookTitle.trim() || 'Untitled'
  const bookTitle = escapeXml(rawTitle)
  const width = Math.max(1, Math.round(input.pageSize[0])) + ''
  const height = Math.max(1, Math.round(input.pageSize[1])) + ''
  const bgColor = input.pageBackgroundColor === 'black' ? '#000000' : '#ffffff'

  const effectiveCoverAlone = input.coverPosition === 'alone' && input.pages.length > 1
  const slots = computePageSlots(input.pages, input.coverPosition, input.pageDirection)

  const pageTemplateRaw = input.imgTag === 'svg' ? getTemplatePageXhtml() : getTemplatePageImgXhtml()
  const pageTemplateBase = fillTemplate(pageTemplateRaw, /\{\{lang\}\}/g, lang)
    .replace(/\{\{title\}\}/g, () => bookTitle)
    .replace(/\{\{width\}\}/g, () => width)
    .replace(/\{\{height\}\}/g, () => height)

  const imageItemStr: string[] = []
  const pageItemStr: string[] = []
  const itemRefStr: string[] = []
  const pageHrefByIndex = new Map<number, string>()
  let hasCoverImage = false

  input.pages.forEach((pageItem, i) => {
    const numStr = i === 0 ? 'cover' : getNumberStr(i - 1, 4)
    let imageFileName = ''

    if (!pageItem.blank && pageItem.image) {
      const ext = getImageExtension(pageItem.image.mimeType)
      if (!ext) {
        throw new Error(`Unsupported EPUB 3.3 Core Media Type image: ${pageItem.image.mimeType}`)
      }

      const imageId = (i === 0 ? '' : 'i_') + numStr
      imageFileName = `${imageId}.${ext}`
      Zip.file(`OEBPS/image/${imageFileName}`, pageItem.image.data)

      if (i === 0) {
        hasCoverImage = true
      }

      imageItemStr.push(
        `<item id="${imageId}" href="image/${imageFileName}" media-type="${escapeXml(pageItem.image.mimeType)}"${i === 0 ? ' properties="cover-image"' : ''} />`
      )
    }

    if (i === 0 && effectiveCoverAlone) {
      // Standalone cover: image asset stays in manifest (cover-image), no cover XHTML or spine itemref.
      return
    }

    const href = `text/p_${numStr}.xhtml`
    pageHrefByIndex.set(i, href)

    const slot = slots[i]
    const align = getPageAlignment(slot, input.pageShow === 'one' ? 'center' : input.pagePosition)
    const isBlankPage = pageItem.blank || !pageItem.image

    if (input.imgTag === 'svg') {
      let body = ''
      if (!isBlankPage) {
        const par = getSvgPreserveAspectRatio(input.pageFit, align)
        body = [
          `<svg xmlns="http://www.w3.org/2000/svg" version="1.1"`,
          ` xmlns:xlink="http://www.w3.org/1999/xlink"`,
          ` width="100%" height="100%" viewBox="0 0 ${width} ${height}">`,
          `<image width="${width}" height="${height}" preserveAspectRatio="${par}" xlink:href="../image/${imageFileName}" />`,
          `</svg>`,
        ].join('\n')
      }

      Zip.file(`OEBPS/${href}`, fillTemplate(pageTemplateBase, '{{body}}', body))
      pageItemStr.push(
        `<item id="p_${numStr}" href="${href}" media-type="application/xhtml+xml"${isBlankPage ? '' : ' properties="svg"'} />`
      )
    } else {
      const body = isBlankPage
        ? '<div style="width:100%;height:100%;"></div>'
        : `<img src="../image/${imageFileName}" alt="" style="${getImgInlineStyle(input.pageFit, align)}" />`

      Zip.file(`OEBPS/${href}`, fillTemplate(pageTemplateBase, '{{body}}', body))
      pageItemStr.push(`<item id="p_${numStr}" href="${href}" media-type="application/xhtml+xml" />`)
    }

    const spreadProp = slot === 'center' ? 'rendition:page-spread-center' : `page-spread-${slot}`
    itemRefStr.push(`<itemref idref="p_${numStr}" linear="yes" properties="${spreadProp}" />`)
  })

  const firstSpineHref = pageHrefByIndex.values().next().value as string

  const sortedUniqueToc = [...input.tocEntries]
    .sort((a, b) => a.pageIndex - b.pageIndex)
    .filter((entry, idx, arr) => idx === 0 || entry.pageIndex !== arr[idx - 1].pageIndex)

  const tocItems: string[] = []
  for (const entry of sortedUniqueToc) {
    const href = pageHrefByIndex.get(entry.pageIndex)
    if (!href) {
      continue
    }
    const displayPageNum = effectiveCoverAlone ? entry.pageIndex : entry.pageIndex + 1
    const label = escapeXml(entry.title.trim() || `Page ${displayPageNum}`)
    tocItems.push(`<li><a href="${href}">${label}</a></li>`)
  }
  if (tocItems.length === 0) {
    tocItems.push(`<li><a href="${firstSpineHref}">${bookTitle}</a></li>`)
  }

  const landmarksItems: string[] = []
  if (!effectiveCoverAlone && pageHrefByIndex.has(0)) {
    landmarksItems.push('<li><a epub:type="cover" href="text/p_cover.xhtml">Cover</a></li>')
    const bodymatterHref = pageHrefByIndex.get(1) ?? 'text/p_cover.xhtml'
    landmarksItems.push(`<li><a epub:type="bodymatter" href="${bodymatterHref}">Start of Content</a></li>`)
  } else {
    landmarksItems.push(`<li><a epub:type="bodymatter" href="${firstSpineHref}">Start of Content</a></li>`)
  }

  const navigationXhtml = fillTemplate(getTemplateNavigationDocumentsXhtml(), /\{\{lang\}\}/g, lang)
    .replace('<!-- navigation-list -->', () => tocItems.join('\n'))
    .replace('<!-- landmarks-list -->', () => landmarksItems.join('\n'))

  const optionalMeta: string[] = []
  const validAuthors = input.bookAuthors.map(a => a.trim()).filter(Boolean)
  validAuthors.forEach((name, i) => {
    const id = `creator${i + 1}`
    optionalMeta.push(`<dc:creator id="${id}">${escapeXml(name)}</dc:creator>`)
    optionalMeta.push(`<meta refines="#${id}" property="role" scheme="marc:relators">aut</meta>`)
    optionalMeta.push(`<meta refines="#${id}" property="display-seq">${i + 1}</meta>`)
  })

  const subject = input.bookSubject.trim()
  if (subject) {
    optionalMeta.push(`<dc:subject>${escapeXml(subject)}</dc:subject>`)
  }

  const publisher = input.bookPublisher.trim()
  if (publisher) {
    optionalMeta.push(`<dc:publisher id="publisher">${escapeXml(publisher)}</dc:publisher>`)
  }

  const identifier = escapeXml(formatIdentifier(input.bookID, input.fallbackUuid))
  const modifiedDate = formatEpubModifiedDate(input.now)
  const spread = input.pageShow === 'one' ? 'none' : 'landscape'
  const direction = input.pageDirection === 'right' ? 'rtl' : 'ltr'

  const standardOpf = getTemplateStandardOpf()
    .replace(/\{\{lang\}\}/g, () => lang)
    .replace('{{title}}', () => bookTitle)
    .replace('{{identifier}}', () => identifier)
    .replace('{{createTime}}', () => modifiedDate)
    .replace('<!-- optional-metadata -->', () => optionalMeta.join('\n'))
    .replace('{{spread}}', () => spread)
    .replace('<!-- legacy-cover -->', () => (hasCoverImage ? '<meta name="cover" content="cover" />' : ''))
    .replace('<!-- item-image -->', () => imageItemStr.join('\n'))
    .replace('<!-- item-xhtml -->', () => pageItemStr.join('\n'))
    .replace('<!-- itemref-xhtml -->', () => itemRefStr.join('\n'))
    .replace('{{direction}}', () => direction)

  const css = fillTemplate(getTemplateFixedLayoutJpCss(), '{{bgColor}}', bgColor)

  Zip.file('META-INF/container.xml', getTemplateContainerXml())
  Zip.file('OEBPS/style/fixed-layout-jp.css', css)
  Zip.file('OEBPS/navigation-documents.xhtml', navigationXhtml)
  Zip.file('OEBPS/standard.opf', standardOpf)

  return Zip
}
