const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests', timeout: 60000, workers: 1, retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
});
