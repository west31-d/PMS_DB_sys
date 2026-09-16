import { defineConfig } from "@playwright/test";
const port = process.env.PMS_TEST_PORT || "5174";
export default defineConfig({
  testDir: "./tests",
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
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_DEMO_MODE: "true",
    },
  },
  reporter: "list",
});
