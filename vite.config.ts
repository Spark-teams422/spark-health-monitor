import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative asset paths: the built site works from any folder (GitHub Pages, Netlify, a USB stick)
  base: './',
  server: { port: 5173 },
  test: { environment: 'node' },
})
