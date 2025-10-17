import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Output directory for the production build
    outDir: path.resolve(__dirname, '../backend/app/static'),
    // The outDir will be emptied before building
    emptyOutDir: true,
  },
})