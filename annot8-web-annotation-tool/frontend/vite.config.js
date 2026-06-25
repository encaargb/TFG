import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // Component tests rely on browser APIs while running in Node.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
  },
})
