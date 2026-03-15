import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // En desarrollo, Vite proxea las llamadas /api al nginx (o directamente al servicio)
    proxy: {
      '/api': {
        target: 'http://nginx:80',
        changeOrigin: true
      }
    }
  }
})
