import { defineConfig } from '@playwright/test';

// Uses the existing focus-preview server and an isolated in-memory preview.
export default defineConfig({
  testDir: '.',
  testMatch: 'menu-radio.spec.ts',
  outputDir: '/tmp/thesis-menu-radio-results',
  reporter: 'list',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4192', viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' },
});
