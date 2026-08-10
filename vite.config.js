import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildStamp = Date.now().toString(36)

function cacheBustIndexHtml() {
  return {
    name: 'cache-bust-index-html',
    transformIndexHtml(html) {
      return html
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), cacheBustIndexHtml()],
  server: {
    host: 'localhost',
  },
  cacheDir: '/private/tmp/crt-roofing-vite-cache',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${buildStamp}-[hash].js`,
        chunkFileNames: `assets/[name]-${buildStamp}-[hash].js`,
        assetFileNames: `assets/[name]-${buildStamp}-[hash][extname]`,
      },
    },
  },
})
