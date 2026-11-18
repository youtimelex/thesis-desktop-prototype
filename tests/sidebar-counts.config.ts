import { defineConfig } from '@playwright/test';

// Uses the existing isolated server and fresh in-memory preview contexts.
export default defineConfig({
  testDir: '.',
  testMatch: 'sidebar-counts.spec.ts',
  outputDir: '/tmp/thesis-sidebar-counts-results',
  reporter: 'list',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4192', viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' },
});
