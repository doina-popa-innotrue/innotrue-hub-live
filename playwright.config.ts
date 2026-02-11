import { defineConfig, devices } from '@playwright/test';

/**
 * InnoTrue Hub — Playwright E2E Test Configuration
 *
 * Tests run against localhost:8080 (local dev server) pointed at preprod Supabase.
 * In CI, tests run against a Cloudflare Pages preview deploy.
 *
 * Usage:
 *   npm run test:e2e          — run all tests headless
 *   npm run test:e2e:ui       — interactive UI mode
 *   npm run test:e2e:headed   — run with visible browser
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Auth setup — runs first to create storageState files */
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },

    /* Main test suite — Chromium */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },

    // Uncomment to test in other browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    //   dependencies: ['auth-setup'],
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    //   dependencies: ['auth-setup'],
    // },
  ],

  /* Auto-start dev server for local runs */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
