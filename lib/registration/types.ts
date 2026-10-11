import type { PaymentState, RegistrationState } from "@/types";

export type PaymentProvider = "razorpay" | "mock";

export interface StoredEntry {
  eventSlug: string;
  teamName: string | null;
  feePaise: number;
  /** Team members other than the registrant. */
  members: string[];
}

/** A registration as persisted. Never sent to the browser as is. */
export interface StoredRegistration {
  id: string;
  reference: string;
  status: RegistrationState;
  paymentStatus: PaymentState;
  amountPaise: number;
  currency: string;
  /** Settled through the mock gateway: no real money moved. */
  isTest: boolean;
  createdAt: string;
  confirmedAt: string | null;
  participant: {
    fullName: string;
    email: string;
    organization: string;
    phone: string | null;
  };
  entries: StoredEntry[];
  /** Gateway id of the captured payment, once there is one. */
  paymentReference: string | null;
}

export interface NewRegistration {
  reference: string;
  clientKeyHash: string;
  amountPaise: number;
  isTest: boolean;
  consentAt: string;
  participant: StoredRegistration["participant"];
  entries: StoredEntry[];
}

export type CreateRegistrationResult =
  /** `existing` means this exact submission was already stored (a retry). */
  | { outcome: "created" | "existing"; registration: StoredRegistration }
  /** The participant already holds a confirmed entry for these events. */
  | { outcome: "duplicate"; eventSlugs: string[] };

export interface StoredOrder {
  provider: PaymentProvider;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  status: "created" | "paid" | "failed";
}

export interface VerifiedPayment {
  provider: PaymentProvider;
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  status: "captured" | "authorized" | "failed";
  method: string | null;
  verifiedVia: "checkout_signature" | "webhook" | "mock";
}

export type RecordPaymentOutcome =
  | "confirmed"
  | "already_confirmed"
  | "pending"
  | "failed"
  | "verification_required"
  | "order_not_found";

export interface RecordPaymentResult {
  outcome: RecordPaymentOutcome;
  registration: StoredRegistration | null;
}

/**
 * Everything the registration service needs from persistence. There are two
 * implementations with the same semantics: Supabase (the transactional SQL
 * functions in supabase/migrations/0002) and an in-memory twin used for demo
 * mode and tests.
 */
export interface RegistrationStore {
  /** "memory" means nothing survives a restart: demo mode. */
  readonly kind: "supabase" | "memory";

  createRegistration(input: NewRegistration): Promise<CreateRegistrationResult>;

  /** Both the reference and the key hash must match. */
  findRegistration(
    reference: string,
    clientKeyHash: string,
  ): Promise<StoredRegistration | null>;

  /** The order still usable for this registration, if one was created. */
  getOpenOrder(registrationId: string): Promise<StoredOrder | null>;

  /**
   * Stores a newly created gateway order. If another request stored one first
   * the existing order is returned instead, so a registration never has two.
   */
  saveOrder(
    registrationId: string,
    order: Omit<StoredOrder, "status">,
  ): Promise<StoredOrder>;

  /** Idempotent: safe to call repeatedly with the same payment. */
  recordPayment(payment: VerifiedPayment): Promise<RecordPaymentResult>;

  /**
   * Claims a webhook delivery. Returns false when that delivery was already
   * processed, so the caller can acknowledge it without doing anything.
   */
  claimWebhookEvent(event: {
    provider: "razorpay";
    eventId: string;
    eventType: string;
    payloadSha256: string;
  }): Promise<boolean>;

  completeWebhookEvent(
    provider: "razorpay",
    eventId: string,
    outcome: string,
  ): Promise<void>;
}
