import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'

function loadLocalCerts() {
  const cert = path.resolve('localhost.pem')
  const key = path.resolve('localhost-key.pem')
  if (fs.existsSync(cert) && fs.existsSync(key)) {
    return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) }
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    https: loadLocalCerts(),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Иконки и манифест отдаём из public/ + статика для офлайна
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons.svg'],
      manifest: {
        name: 'Делим счёт',
        short_name: 'Делим счёт',
        description: 'Делим счёт в поездках: расходы, участники, кто кому должен.',
        lang: 'ru',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#e9e0cb',
        theme_color: '#1e2c44',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
      devOptions: {
        // Чтобы можно было проверять PWA в `npm run dev`
        enabled: false,
      },
    }),
  ],
})
