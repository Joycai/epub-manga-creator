# EPUB Manga Creator

A modern, fast web-based GUI utility to bundle comic and manga images into EPUB format. 

The generated EPUB structure conforms to the specifications of the [Digital Comic Association](http://www.digital-comic.jp/) (デジタルコミック協議会).

🚀 **[Click here to use the app](https://wing-kai.github.io/epub-manga-creator)**

---

## Features

- **Modern Build Stack**: Powered by **Vite 6**, **React 18.3**, and **MobX 6** for blazing-fast development startup, instant Hot Module Replacement (HMR), and optimized production builds.
- **PNPM Package Manager**: Dependency management migrated to **PNPM** for faster installs and efficient disk usage.
- **SSR-Ready & Isomorphic**: Codebase audit and refactoring to eliminate top-level browser DOM references (e.g. module-level `getComputedStyle`), making the core stores and components importable and rendering-safe in Node.js / SSR environments.
- **Localisation (L10n)**: Built-in support for **English** and **Chinese**. 
  - Automatically detects browser language settings upon first load.
  - Seamless, state-managed language switching inside the navigation panel.
  - Persists preference locally (`localStorage`).
- **Domain-specific Features**:
  - Image pagination, split-page support, reading direction configuration (Japanese RTL or LTR).
  - Pre-defined datalists for subjects and Japanese publishers.
  - "Saved Sets" for reuse of metadata presets.

---

## Development

### Prerequisites

- **Node.js**: v24.x recommended
- **Package Manager**: [PNPM](https://pnpm.io/)

### Getting Started

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Start Development Server**
   ```bash
   pnpm start
   ```
   Open your browser to the URL printed in the terminal (usually `http://localhost:5173`).

3. **Build for Production**
   ```bash
   pnpm build
   ```
   Compiles TypeScript and bundles static assets into the `dist/` directory.

4. **Preview Production Build**
   ```bash
   pnpm preview
   ```
   Starts a local server to test the production bundle in the `dist/` directory.