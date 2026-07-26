import { defineConfig, devices } from "@playwright/test";

// E2E config. Run with: npx playwright install (once) then npm run test:e2e.
// Spins up the Vite dev server automatically.
//
// The port MUST match `server.port` in vite.config.ts (3005), not Vite's 5173
// default — pointing at the wrong port makes webServer wait out its timeout and
// every test fail to connect.
const DEV_URL = "http://localhost:3005";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: DEV_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: DEV_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
