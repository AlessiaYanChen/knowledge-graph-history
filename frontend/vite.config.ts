import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, '.', 'VITE_').VITE_API_TARGET || 'http://127.0.0.1:5055'
  return {
    plugins: [react()],
    server: { proxy: { '/api': target } },
    preview: { proxy: { '/api': target } },
  }
})
