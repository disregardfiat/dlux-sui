import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    allowedHosts: ['test.dlux.io', 'dlux.io', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/graphql')
      },
      '/walrus': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  preview: {
    port: 3006,
    strictPort: true,
    allowedHosts: ['test.dlux.io', 'dlux.io', 'localhost']
  }
})