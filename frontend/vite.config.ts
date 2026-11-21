import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import seoPlugin from './seo.plugin.ts'

// Dev proxy targets (override with env vars when the services run elsewhere)
const ZUSIA_API_URL = process.env.ZUSIA_API_URL ?? 'http://127.0.0.1:8000' // python/ (FastAPI: chat, case import)
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:3000' // backend/ (NestJS: engine params)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin()],
  server: {
    proxy: {
      // more specific prefix first
      '/api/zusia': {
        target: ZUSIA_API_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zusia/, ''),
      },
      '/api': {
        target: BACKEND_API_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
