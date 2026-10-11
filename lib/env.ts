import "server-only";
import { parseEnv } from "@/lib/validation/env";

/**
 * Validated server-side environment. Importing this from a Client Component
 * is a build error, which keeps the service-role key out of the browser.
 */
export const env = parseEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  REGISTRATION_STATUS: process.env.REGISTRATION_STATUS,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  PAYMENT_MODE: process.env.PAYMENT_MODE,
  DEV_FEE_OVERRIDE_INR: process.env.DEV_FEE_OVERRIDE_INR,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
});

/** Public reads and organizer sign-in need the URL and anon key. */
export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Saving registrations additionally needs the server-only service-role key. */
export const isRegistrationBackendConfigured =
  isSupabaseConfigured && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);

export const siteUrl =
  env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
