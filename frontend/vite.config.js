import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitePwaPlugin from './pwa/vitePwaPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    vitePwaPlugin(),
  ],
  server: {
    // Serve index.html for all routes so React Router handles them in dev
    historyApiFallback: true,
  },
})
