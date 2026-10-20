import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps the static build working from a subpath.
  base: './',
  build: {
    target: 'es2022',
  },
});
