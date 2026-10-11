import { defineConfig, devices } from "@playwright/test";

const SITE_PORT = 3100;
const OPEN_PORT = 3101;

/** Every variable the site reads, blanked so a local .env cannot leak in. */
const UNCONFIGURED = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  RAZORPAY_KEY_ID: "",
  RAZORPAY_KEY_SECRET: "",
  RAZORPAY_WEBHOOK_SECRET: "",
  PAYMENT_MODE: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
};

/**
 * Two servers, neither connected to a database or a payment gateway:
 *  - the production build with no environment at all (registration not open);
 *  - a second production build (in .next-e2e) with registration open and a
 *    development test fee, to exercise the real flow, the Server Actions and
 *    the mock gateway end to end.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "on-first-retry" },
  projects: [
    {
      name: "desktop",
      testIgnore: /registration-open\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${SITE_PORT}`,
      },
    },
    {
      name: "mobile",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${SITE_PORT}` },
    },
    {
      name: "registration-open",
      testMatch: /registration-open\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${OPEN_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run start -- --port ${SITE_PORT}`,
      url: `http://localhost:${SITE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...UNCONFIGURED,
        REGISTRATION_STATUS: "",
        DEV_FEE_OVERRIDE_INR: "",
      },
    },
    {
      command: `npm run build && npm run start -- --port ${OPEN_PORT}`,
      url: `http://localhost:${OPEN_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...UNCONFIGURED,
        NEXT_DIST_DIR: ".next-e2e",
        REGISTRATION_STATUS: "open",
        DEV_FEE_OVERRIDE_INR: "50",
      },
    },
  ],
});
