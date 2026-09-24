import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// `base` is configurable so the app can be served from GitHub Pages (/travel_dash/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
