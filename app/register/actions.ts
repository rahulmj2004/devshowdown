"use server";

import { getRegistrationContext } from "@/lib/registration/context";
import {
  completeMockPayment,
  confirmCheckout,
  createRegistration,
  getRegistration,
  startPayment,
  type CreateRegistrationResponse,
  type PaymentResponse,
  type RegistrationSummary,
  type StartPaymentResponse,
} from "@/lib/registration/service";

/*
 * Server Actions are public endpoints: anyone can call them with anything.
 * Each one therefore takes `unknown`, and the service re-validates the input
 * and re-derives every fee and rule from server-side configuration.
 */

/**
 * Step 3 -> 4. Stores the registration. A registration with nothing to pay is
 * confirmed here; otherwise it is stored as pending payment.
 */
export async function submitRegistration(
  values: unknown,
  honeypot: unknown = "",
): Promise<CreateRegistrationResponse> {
  // Bots tend to fill every field, including the visually hidden one.
  if (typeof honeypot !== "string" || honeypot.trim() !== "") {
    return { status: "error" };
  }
  return createRegistration(await getRegistrationContext(), values);
}

/** Re-reads a registration after a refresh, or while awaiting verification. */
export async function fetchRegistration(
  access: unknown,
): Promise<RegistrationSummary | null> {
  return getRegistration(await getRegistrationContext(), access);
}

/** Creates (or reuses) the gateway order for a pending registration. */
export async function beginPayment(
  access: unknown,
): Promise<StartPaymentResponse> {
  return startPayment(await getRegistrationContext(), access);
}

/** Verifies what Razorpay Checkout returned to the browser. */
export async function verifyPayment(
  access: unknown,
  payload: unknown,
): Promise<PaymentResponse> {
  return confirmCheckout(await getRegistrationContext(), access, payload);
}

/** Resolves a simulated payment. Refused unless the mock gateway is active. */
export async function resolveMockPayment(
  access: unknown,
  result: unknown,
): Promise<PaymentResponse> {
  return completeMockPayment(await getRegistrationContext(), access, result);
}
