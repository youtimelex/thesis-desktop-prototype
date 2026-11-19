import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'login-vini.spec.ts',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4192', reducedMotion: 'reduce' },
});
