import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  build: {
    rollupOptions: {
      output: {
        // manualChunks as a function is required by rolldown (Vite 6+)
        manualChunks(id: string) {
          if (id.includes('firebase/app') || id.includes('firebase/analytics')) {
            return 'firebase-app';
          }
          if (id.includes('firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('firebase/storage')) {
            return 'firebase-storage';
          }
          if (id.includes('firebase/functions')) {
            return 'firebase-functions';
          }
          if (id.includes('src/pages/Admin') || id.includes('src/components/AdminMarketing')) {
            return 'chunk-admin';
          }
          if (id.includes('src/pages/Clube') || id.includes('src/pages/Roleta') || id.includes('src/pages/BadgesCenter')) {
            return 'chunk-clube';
          }
          if (
            id.includes('src/pages/Profile') ||
            id.includes('src/pages/Addresses') ||
            id.includes('src/pages/Orders') ||
            id.includes('src/pages/Coupons') ||
            id.includes('src/pages/Support')
          ) {
            return 'chunk-profile';
          }
          return undefined;
        },
      },
    },
  },
})
