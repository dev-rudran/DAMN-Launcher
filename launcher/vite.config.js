import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      base: '/',
      manifest: {
        name: 'DAMN Launcher',
        short_name: 'DAMN',
        id: '/',
        start_url: '/',
        display: 'standalone',
        description: 'Game launcher for repack libraries (FitGirl, DODI, AnkerGames), built for controllers.',
        theme_color: '#0a0d13',
        background_color: '#0a0d13',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webmanifest,svg,png,ico,json}'],
        globIgnores: ['data/posters/**'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\/data\/posters\/.*$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'damn-posters',
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
})
