import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxying keeps the API on the same origin in dev, so session cookies work without CORS setup.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
