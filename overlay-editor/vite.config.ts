import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/preview': 'http://localhost:3000',
      '/live-reload.js': 'http://localhost:3000',
      '/live': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
