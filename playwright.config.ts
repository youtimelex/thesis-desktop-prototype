import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/overview.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4192', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4192', reuseExistingServer: true },
});
