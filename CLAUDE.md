# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EPUB Manga Creator V2 is a browser-based single-page app that packages manga/comic images into EPUB 3.0 (fixed-layout, Japanese manga format). The EPUB is generated entirely client-side — no backend.

- **Homepage**: `https://wing-kai.github.io/epub-manga-creator/`
- **Tech stack**: React 19, TypeScript, MobX, Vite, Bootstrap Dark 5

## Commands

```bash
npm start          # Vite dev server
npm run build      # tsc type-check then vite build
npm run preview    # Vite preview of production build
```

There is no test runner configured. `src/setupTests.ts` references `@testing-library/jest-dom` but the package isn't in `devDependencies`.

## Architecture

### State management (MobX)

All state lives in `src/store/`. There is **no router** — modal dialogs and conditional rendering drive navigation.

| File | Responsibility |
|------|---------------|
| `store/main.ts` | Top-level orchestrator. Handles import, page reorder/split/insert/remove, and EPUB generation via JSZip. The single `store` singleton is the default export. |
| `store/book.ts` | Book metadata (title, authors, publisher, etc.) and the ordered `pages` array. Each page has an `index`, `blobID` (key into blobs store), and flags for `blank`/`sticky`. |
| `store/contents.ts` | Table of contents — a `list` of `{pageIndex, title}` plus an `indexMap` for reverse lookup (page → TOC entry). |
| `store/blobs.ts` | Image blob storage keyed by UUID. Each entry holds the raw `Blob`, a blob URL, a thumbnail URL (200px tall), and the original `HTMLImageElement`. |
| `store/ui.ts` | Modal visibility toggles, selected page index, file name, language preference, and the `firstImport` flag. |

Key patterns:
- `store/main.ts` is the **only store** that coordinates across stores. Components never stitch multiple stores together; they call methods on `storeMain`.
- `localStorage` keys: `EPUB_CREATOR_SAVED_SETS_BOOK`, `EPUB_CREATOR_SAVED_SETS_CONTENTS`, `EPUB_CREATOR_LANG`.
- The `firstImport` flag on `storeUI` triggers auto-analysis of the filename on the very first import.

### Component tree

```
App (observer)
├── I18nProvider (context with locale strings)
│   ├── Header (import, modal toggles, page controls, generate, lang switch)
│   ├── Main (page card grid with responsive layout)
│   └── Modal + ModalBackDrop
│       ├── ModalBook (book metadata editor with filename auto-analyze)
│       ├── ModalContents (TOC editor with form/plain-text toggle)
│       └── ModalPage (page size, position, fit, direction, cover settings)
```

### EPUB generation flow (`store/main.ts` → `generateBook()`)

1. Replace placeholders (`{{title}}`, `{{width}}`, etc.) in template strings from `src/template/`.
2. Iterate over `book.pages`: for each page, create the XHTML text file and copy the image blob into the ZIP under `OEBPS/image/`.
3. Assemble `container.xml`, `standard.opf`, `navigation-documents.xhtml`, and CSS via JSZip.
4. Supports two image tag modes: `<svg><image/></svg>` (default) and `<img/>` — controlled by `book.imgTag`.
5. Page spread direction alternates `left`/`right` based on `book.pageDirection` and `book.coverPosition`.

### Import pipeline

- **Images**: Direct file input → `storeMain.importPageFromImages()`.
- **ZIP archives**: JSZip extracts entries, detects MIME type via magic bytes (PNG/JPEG/WebP/AVIF), rebuilds as `File` objects, then imports.
- **EPUB import**: Stubbed out but not implemented (see `Header.tsx` TODO).

### Internationalization

`src/i18n/index.tsx` provides `I18nProvider` (React context) and `useI18n()` hook. Locale strings are in `en.ts` (source of truth for the `Locale` type) and `zh.ts`. Language detection: saved preference → browser `navigator.language` → `'en'` fallback.

### Path resolution

`tsconfig.json` sets `baseUrl: "src"`, so imports like `'store/main'` resolve to `src/store/main.ts`. The `vite-tsconfig-paths` plugin enables this in Vite. The app is deployed under the `/epub-manga-creator/` base path.
