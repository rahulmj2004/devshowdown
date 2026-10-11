import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveFeePaise } from "@/lib/payments/mode";
import { sha256Hex } from "@/lib/payments/signature";
import type { PaymentGateway } from "@/lib/payments/types";
import { upiOrderId, type UpiPayee } from "@/lib/payments/upi";
import { isEventRegistrationOpen } from "@/lib/registration-status";
import {
  checkoutPayloadSchema,
  createRegistrationSchema,
  registrationAccessSchema,
  toFieldErrors,
  upiPaymentSchema,
  type RegistrationFieldErrors,
} from "@/lib/validation/registration";
import type {
  EventConfig,
  PaymentMode,
  PaymentState,
  PhoneFieldMode,
  RegistrationState,
  RegistrationStatus,
} from "@/types";
import type {
  RegistrationStore,
  StoredRegistration,
  VerifiedPayment,
} from "./types";

/**
 * Everything the registration service needs, passed in explicitly so the
 * same code runs against Supabase + Razorpay in production and against the
 * in-memory store + a fake gateway in tests.
 */
export interface RegistrationContext {
  store: RegistrationStore;
  /** Present only when `paymentMode` is "razorpay". */
  gateway: PaymentGateway | null;
  paymentMode: PaymentMode;
  paymentUnavailableReason: string | null;
  /** Who receives UPI payments. Needed when `paymentMode` is "upi". */
  upi?: UpiPayee | null;
  events: readonly EventConfig[];
  registrationStatus: RegistrationStatus;
  phoneField: PhoneFieldMode;
  allowMultipleEvents: boolean;
  devFeeOverride: number | undefined;
  /** Called once, when a registration first becomes confirmed. */
  onConfirmed?: (registration: StoredRegistration) => Promise<void>;
}

/** What the browser is allowed to know about a registration. */
export interface RegistrationSummary {
  reference: string;
  status: RegistrationState;
  paymentStatus: PaymentState;
  amountPaise: number;
  currency: string;
  /** Held in memory only: this is a demo, not a real registration. */
  demo: boolean;
  /** "Paid" through the mock gateway: no money moved. */
  testPayment: boolean;
  fullName: string;
  email: string;
  entries: {
    eventSlug: string;
    eventTitle: string;
    teamName: string | null;
    members: string[];
    feePaise: number;
  }[];
  paymentReference: string | null;
  createdAt: string;
}

export type CreateRegistrationResponse =
  | { status: "created"; registration: RegistrationSummary }
  | { status: "invalid"; fieldErrors: RegistrationFieldErrors }
  | { status: "duplicate"; eventTitles: string[] }
  | { status: "closed" }
  | { status: "payments_unavailable"; reason: string }
  | { status: "error" };

export type CheckoutSession =
  | {
      mode: "razorpay";
      keyId: string;
      orderId: string;
      amountPaise: number;
      currency: string;
      prefill: { name: string; email: string; contact: string | undefined };
    }
  | {
      /** Direct UPI: the participant pays in their own app, then reports it. */
      mode: "upi";
      vpa: string;
      payeeName: string;
      amountPaise: number;
      currency: string;
      /** Goes in the payment note so organizers can match the payment. */
      note: string;
    }
  | { mode: "mock"; orderId: string; amountPaise: number; currency: string };

export type StartPaymentResponse =
  | { status: "ready"; checkout: CheckoutSession }
  /** Nothing to pay, or a decision is pending: show the registration as is. */
  | { status: "settled"; registration: RegistrationSummary }
  | { status: "payments_unavailable"; reason: string }
  | { status: "not_found" }
  | { status: "error" };

export type PaymentResponse =
  | { status: "settled"; registration: RegistrationSummary }
  /** The proof sent by the browser did not check out. Nothing was changed. */
  | {
      status: "rejected";
      registration: RegistrationSummary | null;
      reason?: "invalid_transaction_id" | "transaction_id_in_use";
    }
  | { status: "not_found" }
  | { status: "error" };

export interface WebhookResponse {
  http: 200 | 400 | 401 | 503;
  body: { ok: boolean; result: string };
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_REFERENCE_ATTEMPTS = 4;

export function generateReference(prefix: "DSD" | "DEMO"): string {
  let code = "";
  for (let index = 0; index < 8; index++) {
    code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}

export function toSummary(
  registration: StoredRegistration,
  context: Pick<RegistrationContext, "store" | "events">,
): RegistrationSummary {
  const title = (slug: string) =>
    context.events.find((event) => event.slug === slug)?.title ?? slug;
  return {
    reference: registration.reference,
    status: registration.status,
    paymentStatus: registration.paymentStatus,
    amountPaise: registration.amountPaise,
    currency: registration.currency,
    demo: context.store.kind === "memory",
    testPayment: registration.isTest,
    fullName: registration.participant.fullName,
    email: registration.participant.email,
    entries: registration.entries.map((entry) => ({
      eventSlug: entry.eventSlug,
      eventTitle: title(entry.eventSlug),
      teamName: entry.teamName,
      members: entry.members,
      feePaise: entry.feePaise,
    })),
    paymentReference: registration.paymentReference,
    createdAt: registration.createdAt,
  };
}

async function notifyConfirmed(
  context: RegistrationContext,
  registration: StoredRegistration,
): Promise<void> {
  if (!context.onConfirmed) return;
  try {
    await context.onConfirmed(registration);
  } catch (error) {
    // A failed email must never undo or hide a confirmed registration.
    console.error("[registration] confirmation hook failed:", error);
  }
}

/* ---------------------------------------------------------------- create */

/**
 * Validates and stores a registration. Everything is re-derived on the
 * server: which events are open, the team rules, and every fee. Nothing
 * about price or eligibility is taken from the browser.
 */
export async function createRegistration(
  context: RegistrationContext,
  values: unknown,
): Promise<CreateRegistrationResponse> {
  const openEvents = context.events.filter((event) =>
    isEventRegistrationOpen(event, context.registrationStatus),
  );
  if (openEvents.length === 0) return { status: "closed" };

  const parsed = createRegistrationSchema({
    events: openEvents.map((event) => ({ slug: event.slug, team: event.team })),
    phone: context.phoneField,
    allowMultipleEvents: context.allowMultipleEvents,
  }).safeParse(values);
  if (!parsed.success) {
    return { status: "invalid", fieldErrors: toFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const entries = input.entries.map((entry) => {
    const event = openEvents.find((item) => item.slug === entry.eventSlug)!;
    return {
      ...entry,
      feePaise: resolveFeePaise(
        event.fee,
        context.paymentMode,
        context.devFeeOverride,
      ),
    };
  });
  const amountPaise = entries.reduce((sum, entry) => sum + entry.feePaise, 0);

  if (amountPaise > 0 && context.paymentMode === "unconfigured") {
    return {
      status: "payments_unavailable",
      reason:
        context.paymentUnavailableReason ??
        "Online payment is not configured for this site yet.",
    };
  }

  const base = {
    clientKeyHash: sha256Hex(input.clientKey),
    amountPaise,
    isTest: amountPaise > 0 && context.paymentMode === "mock",
    consentAt: new Date().toISOString(),
    participant: {
      fullName: input.fullName,
      email: input.email,
      organization: input.organization,
      phone: context.phoneField === "hidden" ? null : (input.phone ?? null),
    },
    entries,
  };
  const prefix = context.store.kind === "memory" ? "DEMO" : "DSD";

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await context.store.createRegistration({
          ...base,
          reference: generateReference(prefix),
        });
        if (result.outcome === "duplicate") {
          return {
            status: "duplicate",
            eventTitles: result.eventSlugs.map(
              (slug) =>
                context.events.find((event) => event.slug === slug)?.title ??
                slug,
            ),
          };
        }
        if (
          result.outcome === "created" &&
          result.registration.status === "confirmed"
        ) {
          await notifyConfirmed(context, result.registration);
        }
        return {
          status: "created",
          registration: toSummary(result.registration, context),
        };
      } catch (error) {
        // A reference collision is astronomically unlikely; just draw again.
        if (isUniqueViolation(error) && attempt < MAX_REFERENCE_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error("[registration] create failed:", error);
    return { status: "error" };
  }
}

/* ---------------------------------------------------------------- lookup */

async function findByAccess(
  context: RegistrationContext,
  access: unknown,
): Promise<StoredRegistration | null> {
  const parsed = registrationAccessSchema.safeParse(access);
  if (!parsed.success) return null;
  return context.store.findRegistration(
    parsed.data.reference,
    sha256Hex(parsed.data.clientKey),
  );
}

/** Current, server-side state of a registration, for refresh and polling. */
export async function getRegistration(
  context: RegistrationContext,
  access: unknown,
): Promise<RegistrationSummary | null> {
  try {
    const registration = await findByAccess(context, access);
    return registration ? toSummary(registration, context) : null;
  } catch (error) {
    console.error("[registration] lookup failed:", error);
    return null;
  }
}

/* --------------------------------------------------------------- payment */

/**
 * Prepares checkout for a pending registration. The order is created on the
 * server for the amount the server stored, and an order that already exists
 * is reused, so retrying can never produce a second payable order.
 */
export async function startPayment(
  context: RegistrationContext,
  access: unknown,
): Promise<StartPaymentResponse> {
  try {
    const registration = await findByAccess(context, access);
    if (!registration) return { status: "not_found" };

    const payable =
      registration.status === "pending_payment" &&
      (registration.paymentStatus === "pending" ||
        registration.paymentStatus === "failed");
    if (!payable) {
      return {
        status: "settled",
        registration: toSummary(registration, context),
      };
    }

    if (context.paymentMode === "unconfigured") {
      return {
        status: "payments_unavailable",
        reason:
          context.paymentUnavailableReason ??
          "Online payment is not configured for this site yet.",
      };
    }

    const provider = context.paymentMode;
    let order = await context.store.getOpenOrder(registration.id);
    if (order && order.provider !== provider) {
      // The site's payment mode changed after this order was made.
      console.error(
        `[payments] ${registration.reference} holds a ${order.provider} order but the site now uses ${provider}`,
      );
      return { status: "error" };
    }

    if (!order) {
      if (provider === "mock") {
        order = await context.store.saveOrder(registration.id, {
          provider: "mock",
          providerOrderId: `mock_order_${randomUUID()}`,
          amountPaise: registration.amountPaise,
          currency: "INR",
        });
      } else if (provider === "upi") {
        order = await context.store.saveOrder(registration.id, {
          provider: "upi",
          providerOrderId: upiOrderId(registration.reference),
          amountPaise: registration.amountPaise,
          currency: "INR",
        });
      } else {
        if (!context.gateway) return { status: "error" };
        const created = await context.gateway.createOrder({
          amountPaise: registration.amountPaise,
          currency: "INR",
          receipt: registration.reference,
        });
        if (
          created.amountPaise !== registration.amountPaise ||
          created.currency !== "INR"
        ) {
          console.error(
            "[payments] gateway returned an order for a different amount",
          );
          return { status: "error" };
        }
        order = await context.store.saveOrder(registration.id, {
          provider: "razorpay",
          providerOrderId: created.id,
          amountPaise: created.amountPaise,
          currency: created.currency,
        });
      }
    }

    if (order.provider === "mock") {
      return {
        status: "ready",
        checkout: {
          mode: "mock",
          orderId: order.providerOrderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
        },
      };
    }
    if (order.provider === "upi") {
      if (!context.upi) return { status: "error" };
      return {
        status: "ready",
        checkout: {
          mode: "upi",
          vpa: context.upi.vpa,
          payeeName: context.upi.payeeName,
          amountPaise: order.amountPaise,
          currency: order.currency,
          note: registration.reference,
        },
      };
    }
    if (!context.gateway) return { status: "error" };
    return {
      status: "ready",
      checkout: {
        mode: "razorpay",
        keyId: context.gateway.keyId,
        orderId: order.providerOrderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        prefill: {
          name: registration.participant.fullName,
          email: registration.participant.email,
          contact: registration.participant.phone ?? undefined,
        },
      },
    };
  } catch (error) {
    console.error("[payments] could not start payment:", error);
    return { status: "error" };
  }
}

async function settle(
  context: RegistrationContext,
  payment: VerifiedPayment,
): Promise<StoredRegistration | null> {
  const result = await context.store.recordPayment(payment);
  if (result.outcome === "confirmed" && result.registration) {
    await notifyConfirmed(context, result.registration);
  }
  return result.registration;
}

/**
 * Handles the result Razorpay Checkout hands to the browser. The browser's
 * word is never enough: the signature is checked against the order the server
 * stored, then the payment is fetched from Razorpay with the secret key, and
 * only that server-side status and amount decide the outcome.
 */
export async function confirmCheckout(
  context: RegistrationContext,
  access: unknown,
  payload: unknown,
): Promise<PaymentResponse> {
  try {
    const registration = await findByAccess(context, access);
    if (!registration) return { status: "not_found" };
    const summary = () => toSummary(registration, context);

    const proof = checkoutPayloadSchema.safeParse(payload);
    const order = await context.store.getOpenOrder(registration.id);
    if (
      !proof.success ||
      !context.gateway ||
      !order ||
      order.provider !== "razorpay" ||
      proof.data.razorpay_order_id !== order.providerOrderId ||
      !context.gateway.verifyCheckoutSignature({
        orderId: order.providerOrderId,
        paymentId: proof.data.razorpay_payment_id,
        signature: proof.data.razorpay_signature,
      })
    ) {
      return { status: "rejected", registration: summary() };
    }

    const payment = await context.gateway.fetchPayment(
      proof.data.razorpay_payment_id,
    );
    if (
      payment.orderId !== order.providerOrderId ||
      (payment.status !== "captured" &&
        payment.status !== "authorized" &&
        payment.status !== "failed")
    ) {
      return { status: "rejected", registration: summary() };
    }

    const settled = await settle(context, {
      provider: "razorpay",
      providerOrderId: order.providerOrderId,
      providerPaymentId: payment.id,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      verifiedVia: "checkout_signature",
    });
    return {
      status: "settled",
      registration: toSummary(settled ?? registration, context),
    };
  } catch (error) {
    console.error("[payments] checkout verification failed:", error);
    return { status: "error" };
  }
}

/**
 * Resolves a simulated payment. Available only while the site runs the mock
 * gateway; in any other mode it refuses, so it cannot be used to mark a real
 * registration as paid.
 */
export async function completeMockPayment(
  context: RegistrationContext,
  access: unknown,
  result: unknown,
): Promise<PaymentResponse> {
  if (context.paymentMode !== "mock") return { status: "error" };
  const outcome = z.enum(["success", "failure"]).safeParse(result);
  if (!outcome.success) return { status: "error" };

  try {
    const registration = await findByAccess(context, access);
    if (!registration) return { status: "not_found" };

    const order = await context.store.getOpenOrder(registration.id);
    if (!order || order.provider !== "mock") {
      return {
        status: "rejected",
        registration: toSummary(registration, context),
      };
    }

    const settled = await settle(context, {
      provider: "mock",
      providerOrderId: order.providerOrderId,
      providerPaymentId: `mock_pay_${randomUUID()}`,
      amountPaise: order.amountPaise,
      currency: order.currency,
      status: outcome.data === "success" ? "captured" : "failed",
      method: "mock",
      verifiedVia: "mock",
    });
    return {
      status: "settled",
      registration: toSummary(settled ?? registration, context),
    };
  } catch (error) {
    console.error("[payments] mock payment failed:", error);
    return { status: "error" };
  }
}

/* ------------------------------------------------------------------- upi */

/**
 * Records the UPI transaction ID a participant says they paid with. This is
 * only ever a claim: the registration moves to "verification required" and
 * stays unconfirmed until an organizer has found the payment in their own UPI
 * history. A transaction ID already used for another registration is refused.
 */
export async function submitUpiPayment(
  context: RegistrationContext,
  access: unknown,
  payload: unknown,
): Promise<PaymentResponse> {
  if (context.paymentMode !== "upi") return { status: "error" };

  try {
    const registration = await findByAccess(context, access);
    if (!registration) return { status: "not_found" };
    const summary = () => toSummary(registration, context);

    const payable =
      registration.status === "pending_payment" &&
      (registration.paymentStatus === "pending" ||
        registration.paymentStatus === "failed");
    // Already reported or already settled: show it as it stands.
    if (!payable) return { status: "settled", registration: summary() };

    const claim = upiPaymentSchema.safeParse(payload);
    if (!claim.success) {
      return {
        status: "rejected",
        registration: summary(),
        reason: "invalid_transaction_id",
      };
    }
    const order = await context.store.getOpenOrder(registration.id);
    if (!order || order.provider !== "upi") {
      return { status: "rejected", registration: summary() };
    }

    const result = await context.store.recordPayment({
      provider: "upi",
      providerOrderId: order.providerOrderId,
      providerPaymentId: claim.data.transactionId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      status: "authorized",
      method: "upi",
      verifiedVia: "participant",
    });
    if (result.outcome === "payment_id_in_use") {
      return {
        status: "rejected",
        registration: summary(),
        reason: "transaction_id_in_use",
      };
    }
    return {
      status: "settled",
      registration: toSummary(result.registration ?? registration, context),
    };
  } catch (error) {
    console.error("[payments] UPI claim failed:", error);
    return { status: "error" };
  }
}

export type UpiReviewOutcome =
  /** No UPI claim is waiting on that registration. */
  "nothing_to_review" | "approved" | "rejected" | "needs_attention" | "error";

/**
 * An organizer's decision on a UPI claim. The caller must already have
 * checked that the request comes from an organizer. Approving confirms the
 * registration; rejecting reopens it so the participant can enter the right
 * transaction ID.
 */
export async function reviewUpiPayment(
  context: RegistrationContext,
  reference: string,
  decision: "approve" | "reject",
): Promise<UpiReviewOutcome> {
  try {
    const claim = await context.store.findPaymentClaim(reference);
    if (!claim) return "nothing_to_review";

    const result = await context.store.recordPayment({
      provider: "upi",
      providerOrderId: claim.providerOrderId,
      providerPaymentId: claim.providerPaymentId,
      amountPaise: claim.amountPaise,
      currency: claim.currency,
      status: decision === "approve" ? "captured" : "failed",
      method: "upi",
      verifiedVia: "organizer",
    });
    if (result.outcome === "confirmed" && result.registration) {
      await notifyConfirmed(context, result.registration);
    }
    if (decision === "reject") {
      return result.outcome === "failed" ? "rejected" : "needs_attention";
    }
    return result.outcome === "confirmed" ||
      result.outcome === "already_confirmed"
      ? "approved"
      : "needs_attention";
  } catch (error) {
    console.error("[payments] UPI review failed:", error);
    return "error";
  }
}

/* --------------------------------------------------------------- webhook */

const webhookSchema = z.object({
  event: z.string().max(80),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string().min(1).max(120),
            order_id: z.string().max(120).nullish(),
            amount: z.number().int().nonnegative(),
            currency: z.string().max(10),
            status: z.string().max(40),
            method: z.string().max(40).nullish(),
          }),
        })
        .optional(),
    })
    .default({}),
});

const WEBHOOK_STATUS: Record<string, VerifiedPayment["status"] | undefined> = {
  "payment.captured": "captured",
  "payment.authorized": "authorized",
  "payment.failed": "failed",
  "order.paid": "captured",
};

/**
 * Processes a Razorpay webhook. The signature is verified over the exact raw
 * body before anything is parsed. Each delivery id is claimed once, so a
 * redelivery is acknowledged without being applied again; and because
 * recording a payment is itself idempotent, even a delivery that is
 * reprocessed after a crash cannot double-apply.
 *
 * Throws only for unexpected failures, so the caller answers 5xx and Razorpay
 * retries later.
 */
export async function handleRazorpayWebhook(
  context: RegistrationContext,
  request: {
    rawBody: string;
    signature: string | null;
    eventId: string | null;
  },
): Promise<WebhookResponse> {
  const reply = (http: WebhookResponse["http"], result: string) => ({
    http,
    body: { ok: http === 200, result },
  });

  if (!context.gateway?.webhookConfigured) {
    return reply(503, "webhook_not_configured");
  }
  if (
    !context.gateway.verifyWebhookSignature(request.rawBody, request.signature)
  ) {
    return reply(401, "invalid_signature");
  }

  let parsed;
  try {
    parsed = webhookSchema.safeParse(JSON.parse(request.rawBody));
  } catch {
    return reply(400, "invalid_json");
  }
  if (!parsed.success) return reply(400, "invalid_payload");

  const payloadSha256 = sha256Hex(request.rawBody);
  // Razorpay sends a unique id per event; the body hash is the fallback.
  const eventId = request.eventId?.slice(0, 200) || `sha256:${payloadSha256}`;

  const claimed = await context.store.claimWebhookEvent({
    provider: "razorpay",
    eventId,
    eventType: parsed.data.event,
    payloadSha256,
  });
  if (!claimed) return reply(200, "duplicate");

  const status = WEBHOOK_STATUS[parsed.data.event];
  const entity = parsed.data.payload.payment?.entity;
  let result = "ignored";

  if (status && entity?.order_id) {
    // `order.paid` carries the payment too; only act on it if truly captured.
    const actionable =
      parsed.data.event !== "order.paid" || entity.status === "captured";
    if (actionable) {
      const outcome = await context.store.recordPayment({
        provider: "razorpay",
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
        amountPaise: entity.amount,
        currency: entity.currency,
        status,
        method: entity.method ?? null,
        verifiedVia: "webhook",
      });
      result = outcome.outcome;
      if (outcome.outcome === "confirmed" && outcome.registration) {
        await notifyConfirmed(context, outcome.registration);
      }
    }
  }

  await context.store.completeWebhookEvent("razorpay", eventId, result);
  return reply(200, result);
}
