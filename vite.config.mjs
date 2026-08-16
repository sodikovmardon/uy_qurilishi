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
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(rootDir, 'frontend/index.html'),
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
