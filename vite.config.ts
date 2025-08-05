import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    fs: {
      allow: ['..'], // 상위 디렉토리 접근 허용
    },
  },
})