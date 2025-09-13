import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3333,
    proxy: {
      '/api': {
        target: 'https://dongam-culture-analyzer.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
