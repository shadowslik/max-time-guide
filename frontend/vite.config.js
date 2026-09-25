import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Прототип mini-app «Рядом» для MAX.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
