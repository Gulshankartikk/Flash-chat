import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      },
      manifest: {
        name: 'Flash Chat',
        short_name: 'Flash',
        description: 'Super-App Messaging, WebRTC Calls, Social Media & Private Vault',
        theme_color: '#F97316',
        background_color: '#FFF7ED',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'New Chat',
            short_name: 'Chat',
            description: 'Start a direct chat',
            url: '/chats/new',
            icons: [{ src: '/icons/icon.svg', sizes: '192x192' }]
          },
          {
            name: 'New Post',
            short_name: 'Post',
            description: 'Create a new post or reel',
            url: '/social',
            icons: [{ src: '/icons/icon.svg', sizes: '192x192' }]
          },
          {
            name: 'Pocket Vault',
            short_name: 'Pocket',
            description: 'Open your private vault',
            url: '/pocket',
            icons: [{ src: '/icons/icon.svg', sizes: '192x192' }]
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
          socket: ['socket.io-client'],
          icons: ['lucide-react']
        }
      }
    }
  }
});
