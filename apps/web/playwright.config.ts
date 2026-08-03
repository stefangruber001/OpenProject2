import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Playwright boots the dev server itself (see `webServer`)
 * and drives a real browser against it.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // CHROME_PATH points at a browser that is already on the machine, for
        // sandboxes whose pre-installed Chromium build does not match the one
        // this Playwright version would download. Same escape hatch the
        // site-e2e harness uses; CI leaves it unset and gets the default.
        ...(process.env.CHROME_PATH
          ? { launchOptions: { executablePath: process.env.CHROME_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // e2e exercises the in-memory runtime unless a database is provided
      // explicitly via E2E_DATABASE_URL (a set-but-unreachable local .env
      // DATABASE_URL must not leak into the app under test).
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
    },
  },
});
