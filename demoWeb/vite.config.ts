import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the Next app's `@/` alias so ported components need no import
    // rewriting beyond the framework-specific ones.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5173 },
});
