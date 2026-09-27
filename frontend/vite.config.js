import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Прототип mini-app «Рядом» для MAX.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // В dev /api проксируем на задеплоенный бэкенд, чтобы `npm run dev` работал
    // без локального сервера. В проде /api отдаёт тот же домен через Caddy.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
