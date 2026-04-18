import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-dom') || id.includes('/react/')) {
            return 'react-vendor'
          }

          if (id.includes('/zod/')) {
            return 'validation-vendor'
          }

          if (id.includes('/zustand/') || id.includes('/idb/')) {
            return 'workspace-vendor'
          }

          if (id.includes('/jszip/')) {
            return 'import-export-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  plugins: [react()],
})
