# Production Deployment Guide (生产环境部署指南)

Since **EPUB Manga Creator** is a purely client-side Single Page Application (SPA), the production build consists entirely of static assets (HTML, JS, CSS, and images). You can host it on any static file hosting service or web server.

---

## Table of Contents (目录)

- [1. Building for Production (生产环境打包)](#1-building-for-production-生产环境打包)
- [2. Configuration: Base Path (配置静态资源基准路径)](#2-configuration-base-path-配置静态资源基准路径)
- [3. Deployment Options (部署方案)](#3-deployment-options-部署方案)
  - [Option A: GitHub Pages (Recommended / Default)](#option-a-github-pages-recommended--default)
  - [Option B: Cloud Platforms (Vercel, Netlify, Cloudflare Pages)](#option-b-cloud-platforms-vercel-netlify-cloudflare-pages)
  - [Option C: Self-Hosted Nginx](#option-c-self-hosted-nginx)
  - [Option D: Docker Deployment (Containerised)](#option-d-docker-deployment-containerised)
  - [Option E: Self-Hosted Caddy](#option-e-self-hosted-caddy)
- [4. Local Verification Before Deploying (部署前本地验证)](#4-local-verification-before-deploying-部署前本地验证)

---

## 1. Building for Production (生产环境打包)

To compile the application into optimised, minified production assets, run:

```bash
pnpm build
```

This runs the TypeScript compiler (`tsc`) to check for errors, and then runs Vite (`vite build`) to bundle the project.

### Build Output
The built files will be located in the **`dist/`** directory at the root of the project:
- `dist/index.html`: The main entry point.
- `dist/assets/`: Bundled and minified CSS/JS files (with content hashes for caching).

---

## 2. Configuration: Base Path (配置静态资源基准路径)

Depending on where you host the application, you may need to adjust the `base` path configuration in [vite.config.ts](file:///d:/github/epub-manga-creator/vite.config.ts).

```typescript
// vite.config.ts
export default defineConfig({
  base: '/epub-manga-creator/', // <--- Edit this base path
  // ...
});
```

- **Subfolder Hosting** (Default): If your app is hosted at `https://example.com/epub-manga-creator/` (like GitHub Pages), keep the base path as `/epub-manga-creator/`.
- **Domain Root Hosting**: If your app is hosted at the root of a domain (e.g., `https://example.com/` or on Vercel/Netlify), change the base path to `'/'`.
- **Relative Hosting**: If you want the app to be runnable locally by double-clicking the `index.html` file or want relative paths, set it to `'./'`.

---

## 3. Deployment Options (部署方案)

### Option A: GitHub Pages (Recommended / Default)
The project is configured out-of-the-box for GitHub Pages deployment.

#### Manual Deploy:
1. Make sure `base` in `vite.config.ts` is set to `'/epub-manga-creator/'` (or your repository name).
2. Install the `gh-pages` helper package (if not already installed):
   ```bash
   pnpm add -D gh-pages
   ```
3. Add a deploy script to `package.json`:
   ```json
   "scripts": {
     "predeploy": "pnpm build",
     "deploy": "gh-pages -d dist"
   }
   ```
4. Run the deployment:
   ```bash
   pnpm deploy
   ```

---

### Option B: Cloud Platforms (Vercel, Netlify, Cloudflare Pages)
These platforms auto-detect Vite projects and offer global CDN distribution.

Configure the build settings in their dashboards as follows:
- **Build Command**: `pnpm build`
- **Output Directory**: `dist`
- **Root Directory**: `./` (or project root)
- **Node.js Version**: `24.x` (or `>= 20.x`)

> [!NOTE]
> Make sure to set the `base` path in `vite.config.ts` to `'/'` when deploying to these root-domain services.

---

### Option C: Self-Hosted Nginx
To host the application on your own Linux server using Nginx, follow these steps:

1. Copy the contents of the `dist/` folder to your server's web root (e.g., `/var/www/epub-manga-creator`).
2. Add a server block to your Nginx configuration (e.g., `/etc/nginx/sites-available/default`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /var/www/epub-manga-creator;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Cache control for static assets (Vite adds hashes to filenames)
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, no-transform";
        }
    }
}
```
3. Reload Nginx: `sudo systemctl reload nginx`.

---

### Option D: Docker Deployment (Containerised)
If you prefer running the application inside a Docker container, you can use the following multi-stage build `Dockerfile` which builds the project and serves it via a lightweight Nginx container.

Create a `Dockerfile` at the project root:

```dockerfile
# Stage 1: Build the React application
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Update base configuration if needed (e.g. using environment variables)
RUN pnpm build

# Stage 2: Serve the static files using Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom nginx config if required to handle SPA routing
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run the container:
```bash
docker build -t epub-manga-creator .
docker run -d -p 8080:80 epub-manga-creator
```

---

### Option E: Self-Hosted Caddy
[Caddy](https://caddyserver.com/) is a modern, simple web server that automatically provisions and renews SSL/TLS certificates (HTTPS) for you.

1. Copy the contents of the `dist/` folder to your server's web root (e.g., `/var/www/epub-manga-creator`).
2. Create or edit your `Caddyfile` (usually `/etc/caddy/Caddyfile`):

```caddyfile
yourdomain.com {
    # Define the folder containing static files
    root * /var/www/epub-manga-creator

    # Serve static files, fall back to index.html for React SPA routing
    try_files {path} /index.html

    # Enable the file server
    file_server

    # Compress responses using zstd or gzip
    encode zstd gzip

    # Custom Cache-Control header for static assets (highly recommended)
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
}
```
3. Restart or reload Caddy to apply changes:
   ```bash
   sudo systemctl reload caddy
   ```

---

## 4. Local Verification Before Deploying (部署前本地验证)

It is highly recommended to run and test the production bundle locally before pushed live. Vite provides a built-in static server for this purpose:

```bash
pnpm preview
```

This starts a server at `http://localhost:4173/epub-manga-creator/` using the exact files in your `dist/` directory, allowing you to double-check that routing, language settings, and core functionalities operate properly under production conditions.
