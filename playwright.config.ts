import { defineConfig } from '@playwright/test';

/**
 * Smoke tests run against the built site (`pnpm build` first).
 * `astro preview` serves ./dist on :4321.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:4321',
  },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
