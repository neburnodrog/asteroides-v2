import { defineConfig, devices } from "@playwright/test";

// Coerced exactly as webpack.config.js does it, so a bad PORT sends both to the same place
// rather than leaving the suite polling a URL the server never bound.
const baseURL = `http://localhost:${Number(process.env.PORT) || 8080}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./.playwright-test/results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: ".playwright-test/report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start:test",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
