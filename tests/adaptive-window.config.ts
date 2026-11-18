import { defineConfig } from '@playwright/test';

// Uses the existing isolated server and an in-memory preview; never starts a server.
export default defineConfig({
  testDir: '.',
  testMatch: 'adaptive-window.spec.ts',
  outputDir: '/tmp/thesis-adaptive-window-results',
  reporter: 'list',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4192', viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' },
});
