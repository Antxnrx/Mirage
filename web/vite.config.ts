import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Builds into server/public, which the API server serves as static files.
// The built output is committed, so deploying needs no frontend build step.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: '../server/public', emptyOutDir: true },
  server: { proxy: { '/api': { target: 'https://mirage.140-238-167-7.nip.io', changeOrigin: true } } },
});
