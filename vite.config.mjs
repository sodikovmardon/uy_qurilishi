import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/static/react/',
  root: 'frontend',
  build: {
    outDir: '../house_calc/static/react',
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: resolve(rootDir, 'frontend/index.html'),
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
