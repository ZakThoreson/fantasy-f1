import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works under a GitHub Pages project path
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  build: {
    outDir: 'dist',
  },
});
