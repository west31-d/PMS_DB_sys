import { defineConfig } from "@playwright/test";
const port = process.env.PMS_TEST_PORT || "5174";
const liveTest = process.env.PMS_TEST_LIVE === "true";
export default defineConfig({
  testDir: "./tests",
  testMatch: liveTest ? "**/reservation-live.spec.ts" : undefined,
  testIgnore: liveTest ? undefined : "**/reservation-live.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:" + port,
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port " + port + " --strictPort",
    url: "http://127.0.0.1:" + port,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: liveTest ? "https://pms-test.supabase.co" : "",
      VITE_SUPABASE_PUBLISHABLE_KEY: liveTest ? "test-publishable-key" : "",
      VITE_DEMO_MODE: liveTest ? "false" : "true",
    },
  },
  reporter: "list",
});
