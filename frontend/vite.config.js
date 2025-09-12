import { defineConfig } from 'vite';

export default defineConfig({
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
