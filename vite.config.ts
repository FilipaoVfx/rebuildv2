import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base` apunta al subdirectorio de GitHub Pages (<usuario>.github.io/rebuildv2/).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/rebuildv2/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1800 },
});
