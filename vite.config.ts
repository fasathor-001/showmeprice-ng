
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [ tailwindcss(), react()],
  base: '/', // Root-absolute paths required for SPA deep-links on Cloudflare Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
  }
});

