import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const LEGACY_ROUTES = ['/pages/', '/assets/', '/login.html']

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function legacyStaticMiddleware(root: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathname = (req.url || '').split('?')[0]
    const isLegacy = LEGACY_ROUTES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    )
    if (!isLegacy) return next()

    const relative = decodeURIComponent(pathname)
    const filePath = path.normalize(path.join(root, relative))
    if (!filePath.startsWith(root)) return next()
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()

    const ext = path.extname(filePath).toLowerCase()
    res.statusCode = 200
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
    fs.createReadStream(filePath).pipe(res)
  }
}

function legacyDevPlugin() {
  return {
    name: 'legacy-static-dev',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(legacyStaticMiddleware(repoRoot))
    },
  }
}

export default defineConfig({
  plugins: [react(), legacyDevPlugin()],
  base: '/app/',
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  build: {
    outDir: path.resolve(repoRoot, 'app'),
    emptyOutDir: true,
    sourcemap: true,
  },
})
