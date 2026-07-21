import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // In ascolto anche sulla rete locale: serve per provare l'app dai
  // telefoni (i QR di check-in vanno aperti da un altro dispositivo).
  server: {
    host: true,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
