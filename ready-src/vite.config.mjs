import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/ready/',
  plugins: [react()],
  build: {
    outDir: path.resolve(root, '../ready'),
    emptyOutDir: true,
  },
});
