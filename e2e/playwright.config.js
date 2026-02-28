// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir:    './tests',
  timeout:    60_000,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 2 : undefined,
  reporter:   process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',

  use: {
    baseURL:       process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace:         'on-first-retry',   // capture trace only on failure
    video:         'on-first-retry',
    screenshot:    'only-on-failure',
    // Realistic user agent
    userAgent: 'Mozilla/5.0 (Playwright TestRunner)',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    // Mobile viewport smoke test
    {
      name:  'mobile-chrome',
      use:   { ...devices['Pixel 7'] },
      testMatch: '**/mobile.spec.js',
    },
  ],

  // Spin up app before E2E if running locally
  // In CI the app is started separately in the workflow
  webServer: process.env.CI ? undefined : {
    command:   'cd ../server && node index.js',
    url:       'http://localhost:5000/api/health',
    reuseExistingServer: true,
    timeout:   30_000,
  },
});
