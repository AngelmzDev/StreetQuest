import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'StreetQuest',
        short_name: 'StreetQuest',
        description: 'Aprende las calles de cualquier municipio sin conexión.',
        theme_color: '#17352d',
        background_color: '#f3efe4',
        display: 'standalone',
        lang: 'es',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}', 'colmenarejo-osm.json'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'release/**'],
  },
})
