import { defineConfig } from '@playwright/test';

// This config never starts a server, installs fixtures, or touches port 4186.
export default defineConfig({
  testDir: '.',
  testMatch: 'focus-navigation.spec.ts',
  outputDir: '/tmp/thesis-focus-playwright-results',
  reporter: 'list',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4192', viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' },
});
