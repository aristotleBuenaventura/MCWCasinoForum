/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const wpTarget = process.env.MCW_WP_URL || 'http://127.0.0.1:8080'
const expressTarget = process.env.MCW_API_URL || 'http://127.0.0.1:4000'

export default defineConfig(({ mode }) => {
  const useWordpress = mode !== 'express'
  const apiTarget = useWordpress ? wpTarget : expressTarget

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: useWordpress
            ? (path) => path.replace(/^\/api/, '/wp-json/mcw/v1')
            : undefined,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: useWordpress
            ? (path) => path.replace(/^\/uploads/, '/wp-content/uploads')
            : undefined,
        },
        '/wp-content': {
          target: wpTarget,
          changeOrigin: true,
        },
      },
    },
  }
})

