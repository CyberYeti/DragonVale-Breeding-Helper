/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves the site from /<repo>/. Harmless locally: `npm run dev`
// serves at http://localhost:5173/DragonVale-Breeding-Helper/.
export default defineConfig({
  base: '/DragonVale-Breeding-Helper/',
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts', 'scraper/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
