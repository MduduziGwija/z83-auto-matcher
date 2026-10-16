import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' keeps the build working on GitHub Pages project sites.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
