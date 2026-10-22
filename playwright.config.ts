import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: true, workers: 2,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npm run start", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
