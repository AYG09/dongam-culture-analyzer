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
        target: 'http://127.0.0.1:65432',
        changeOrigin: true,
      },
    },
  },
});
