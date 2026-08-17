import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/static/react/',
  build: {
    outDir: '../house_calc/static/react',
    emptyOutDir: true,
  },
});
