import "server-only";
import { getEvents } from "@/config/events";
import { siteConfig } from "@/config/site";
import { getSiteSettings } from "@/lib/data/settings";
import { sendConfirmationEmail } from "@/lib/email";
import { env, isRegistrationBackendConfigured } from "@/lib/env";
import { createRazorpayGateway } from "@/lib/payments/gateway";
import { resolvePaymentMode } from "@/lib/payments/mode";
import type { PaymentGateway } from "@/lib/payments/types";
import { createServiceClient } from "@/lib/supabase/service";
import { MemoryRegistrationStore } from "./memory-store";
import type { RegistrationContext } from "./service";
import { SupabaseRegistrationStore } from "./supabase-store";
import type { RegistrationStore } from "./types";

/** How this deployment takes payment. Fixed for the life of the process. */
export const payment = resolvePaymentMode({
  hasDatabase: isRegistrationBackendConfigured,
  keyId: env.RAZORPAY_KEY_ID,
  keySecret: env.RAZORPAY_KEY_SECRET,
  requested: env.PAYMENT_MODE,
});

/** True when registrations are only held in memory: nothing is real. */
export const isDemoMode = !isRegistrationBackendConfigured;

/* The demo store lives on globalThis so it survives hot reloads in dev. */
const globalStore = globalThis as typeof globalThis & {
  __devshowdownDemoStore?: MemoryRegistrationStore;
};

function getStore(): RegistrationStore {
  const supabase = createServiceClient();
  if (supabase) return new SupabaseRegistrationStore(supabase);
  globalStore.__devshowdownDemoStore ??= new MemoryRegistrationStore();
  return globalStore.__devshowdownDemoStore;
}

let gateway: PaymentGateway | null | undefined;

function getGateway(): PaymentGateway | null {
  if (gateway !== undefined) return gateway;
  gateway =
    payment.mode === "razorpay" &&
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET
      ? createRazorpayGateway({
          keyId: env.RAZORPAY_KEY_ID,
          keySecret: env.RAZORPAY_KEY_SECRET,
          webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        })
      : null;
  return gateway;
}

/** Builds the service context for one request from server-side state only. */
export async function getRegistrationContext(): Promise<RegistrationContext> {
  const settings = await getSiteSettings();
  return {
    store: getStore(),
    gateway: getGateway(),
    paymentMode: payment.mode,
    paymentUnavailableReason: payment.reason,
    events: getEvents(),
    registrationStatus: settings.registrationStatus,
    phoneField: siteConfig.registration.phoneField,
    allowMultipleEvents: siteConfig.registration.allowMultipleEvents,
    devFeeOverride: env.DEV_FEE_OVERRIDE_INR,
    onConfirmed: sendConfirmationEmail,
  };
}
