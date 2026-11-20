import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' serve per far funzionare i percorsi dentro l'APK Capacitor
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
