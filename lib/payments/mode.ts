import type { PaymentMode } from "@/types";

export interface PaymentModeInput {
  /** A real database is connected, so registrations persist. */
  hasDatabase: boolean;
  keyId: string | undefined;
  keySecret: string | undefined;
  /** A UPI ID is configured in `config/site.ts`. */
  hasUpiPayee?: boolean;
  /** Not a production build: UPI screens may be previewed without a database. */
  allowUpiPreview?: boolean;
  /** `PAYMENT_MODE` from the environment. */
  requested: "mock" | undefined;
}

export interface PaymentModeResult {
  mode: PaymentMode;
  /** Why online payment is unavailable, when it is. */
  reason: string | null;
}

/**
 * Decides how this deployment takes payment.
 *
 *  - `PAYMENT_MODE=mock` always wins: a simulated gateway, clearly labelled.
 *  - Razorpay keys enable real payments, with one guard: live keys are refused
 *    unless a database is connected, because taking real money that cannot be
 *    recorded would be worse than taking none.
 *  - Without keys, a configured UPI ID enables direct UPI payment that an
 *    organizer verifies by hand. It needs a database for the same reason.
 *  - With nothing configured and no database the whole site is a demo, so
 *    the mock gateway is used; with a database but no way to pay, payment is
 *    unconfigured and paid registrations are refused outright.
 */
export function resolvePaymentMode(input: PaymentModeInput): PaymentModeResult {
  if (input.requested === "mock") return { mode: "mock", reason: null };

  if (input.keyId && input.keySecret) {
    if (!input.hasDatabase && !input.keyId.startsWith("rzp_test_")) {
      return {
        mode: "unconfigured",
        reason:
          "Live Razorpay keys are set but no database is connected, so payments could not be recorded.",
      };
    }
    return { mode: "razorpay", reason: null };
  }

  if (input.hasUpiPayee) {
    if (!input.hasDatabase && !input.allowUpiPreview) {
      return {
        mode: "unconfigured",
        reason:
          "A UPI ID is set but no database is connected, so payments could not be recorded.",
      };
    }
    return { mode: "upi", reason: null };
  }

  if (!input.hasDatabase) return { mode: "mock", reason: null };
  return {
    mode: "unconfigured",
    reason: "Razorpay keys have not been configured for this site.",
  };
}

/** Whole rupees to paise. Fees are configured in rupees, charged in paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * The fee charged for one event entry, in paise.
 *
 * An unconfirmed fee (`null`) charges nothing. `DEV_FEE_OVERRIDE_INR` exists
 * so the payment flow can be exercised before fees are confirmed, and it is
 * honoured only by the mock gateway: it can never change what a real
 * participant is charged.
 */
export function resolveFeePaise(
  configuredFee: number | null,
  mode: PaymentMode,
  devOverride: number | undefined,
): number {
  if (mode === "mock" && devOverride !== undefined) {
    return rupeesToPaise(devOverride);
  }
  return configuredFee === null ? 0 : rupeesToPaise(configuredFee);
}
