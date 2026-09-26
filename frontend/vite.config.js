import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Прототип mini-app «Рядом» для MAX.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  // MapLibre поднимает web worker. Если Vite предварительно собирает пакет,
  // воркер теряет свой URL и падает с «Worker failed to load» — исключаем.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'es' },
});
