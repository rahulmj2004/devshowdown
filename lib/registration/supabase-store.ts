import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CreateRegistrationResult,
  NewRegistration,
  PaymentClaim,
  RecordPaymentResult,
  RegistrationStore,
  StoredOrder,
  StoredRegistration,
  VerifiedPayment,
} from "./types";

/** Postgres unique-violation code. */
const UNIQUE_VIOLATION = "23505";

const snapshotSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(["pending_payment", "confirmed", "superseded"]),
  payment_status: z.enum([
    "not_required",
    "pending",
    "paid",
    "failed",
    "verification_required",
  ]),
  amount_paise: z.number().int(),
  currency: z.string(),
  is_test: z.boolean(),
  created_at: z.string(),
  confirmed_at: z.string().nullable(),
  participant: z.object({
    full_name: z.string(),
    email: z.string(),
    organization: z.string(),
    phone: z.string().nullable(),
  }),
  entries: z.array(
    z.object({
      event_slug: z.string(),
      team_name: z.string().nullable(),
      fee_paise: z.number().int(),
      members: z.array(z.string()),
    }),
  ),
  payment_reference: z.string().nullable(),
});

function fromSnapshot(value: unknown): StoredRegistration {
  const row = snapshotSchema.parse(value);
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    paymentStatus: row.payment_status,
    amountPaise: row.amount_paise,
    currency: row.currency,
    isTest: row.is_test,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    participant: {
      fullName: row.participant.full_name,
      email: row.participant.email,
      organization: row.participant.organization,
      phone: row.participant.phone,
    },
    entries: row.entries.map((entry) => ({
      eventSlug: entry.event_slug,
      teamName: entry.team_name,
      feePaise: entry.fee_paise,
      members: entry.members,
    })),
    paymentReference: row.payment_reference,
  };
}

const createResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("created"), registration: z.unknown() }),
  z.object({ outcome: z.literal("existing"), registration: z.unknown() }),
  z.object({
    outcome: z.literal("duplicate"),
    event_slugs: z.array(z.string()),
  }),
]);

const recordResultSchema = z.object({
  outcome: z.enum([
    "confirmed",
    "already_confirmed",
    "pending",
    "failed",
    "verification_required",
    "payment_id_in_use",
    "order_not_found",
  ]),
  registration: z.unknown().nullable(),
});

const orderRowSchema = z.object({
  provider: z.enum(["razorpay", "upi", "mock"]),
  provider_order_id: z.string(),
  amount_paise: z.number().int(),
  currency: z.string(),
  status: z.enum(["created", "paid", "failed"]),
});

function toOrder(value: unknown): StoredOrder {
  const row = orderRowSchema.parse(value);
  return {
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    amountPaise: row.amount_paise,
    currency: row.currency,
    status: row.status,
  };
}

const claimSchema = z.object({
  provider_order_id: z.string(),
  provider_payment_id: z.string(),
  amount_paise: z.number().int(),
  currency: z.string(),
});

const ORDER_COLUMNS =
  "provider, provider_order_id, amount_paise, currency, status";

/**
 * Supabase-backed store. It must be given the service-role client: every
 * table it touches is closed to the anon key by Row Level Security. The
 * multi-row writes are single SQL functions, so each is one transaction.
 */
export class SupabaseRegistrationStore implements RegistrationStore {
  readonly kind = "supabase" as const;

  constructor(private readonly supabase: SupabaseClient) {}

  async createRegistration(
    input: NewRegistration,
  ): Promise<CreateRegistrationResult> {
    const { data, error } = await this.supabase.rpc("create_registration", {
      p: {
        reference: input.reference,
        client_key_hash: input.clientKeyHash,
        amount_paise: input.amountPaise,
        is_test: input.isTest,
        consent_at: input.consentAt,
        participant: {
          full_name: input.participant.fullName,
          email: input.participant.email,
          organization: input.participant.organization,
          phone: input.participant.phone,
        },
        entries: input.entries.map((entry) => ({
          event_slug: entry.eventSlug,
          team_name: entry.teamName,
          fee_paise: entry.feePaise,
          members: entry.members,
        })),
      },
    });
    if (error) throw new StoreError("create_registration", error);

    const result = createResultSchema.parse(data);
    if (result.outcome === "duplicate") {
      return { outcome: "duplicate", eventSlugs: result.event_slugs };
    }
    return {
      outcome: result.outcome,
      registration: fromSnapshot(result.registration),
    };
  }

  async findRegistration(reference: string, clientKeyHash: string) {
    const { data, error } = await this.supabase.rpc("find_registration", {
      p_reference: reference,
      p_client_key_hash: clientKeyHash,
    });
    if (error) throw new StoreError("find_registration", error);
    return data ? fromSnapshot(data) : null;
  }

  async getOpenOrder(registrationId: string): Promise<StoredOrder | null> {
    const { data, error } = await this.supabase
      .from("payment_orders")
      .select(ORDER_COLUMNS)
      .eq("registration_id", registrationId)
      .in("status", ["created", "paid"])
      .limit(1)
      .maybeSingle();
    if (error) throw new StoreError("payment_orders.select", error);
    return data ? toOrder(data) : null;
  }

  async saveOrder(
    registrationId: string,
    order: Omit<StoredOrder, "status">,
  ): Promise<StoredOrder> {
    const { data, error } = await this.supabase
      .from("payment_orders")
      .insert({
        registration_id: registrationId,
        provider: order.provider,
        provider_order_id: order.providerOrderId,
        amount_paise: order.amountPaise,
        currency: order.currency,
      })
      .select(ORDER_COLUMNS)
      .single();

    if (error?.code === UNIQUE_VIOLATION) {
      // Another request stored an order for this registration first. Use that
      // one; the order just created at the gateway is simply never paid.
      const existing = await this.getOpenOrder(registrationId);
      if (existing) return existing;
    }
    if (error) throw new StoreError("payment_orders.insert", error);
    return toOrder(data);
  }

  async recordPayment(payment: VerifiedPayment): Promise<RecordPaymentResult> {
    const { data, error } = await this.supabase.rpc("record_payment", {
      p: {
        provider: payment.provider,
        provider_order_id: payment.providerOrderId,
        provider_payment_id: payment.providerPaymentId,
        amount_paise: payment.amountPaise,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        verified_via: payment.verifiedVia,
      },
    });
    if (error) throw new StoreError("record_payment", error);

    const result = recordResultSchema.parse(data);
    return {
      outcome: result.outcome,
      registration: result.registration
        ? fromSnapshot(result.registration)
        : null,
    };
  }

  async findPaymentClaim(reference: string): Promise<PaymentClaim | null> {
    const { data, error } = await this.supabase.rpc("find_payment_claim", {
      p_reference: reference,
    });
    if (error) throw new StoreError("find_payment_claim", error);
    if (!data) return null;
    const row = claimSchema.parse(data);
    return {
      providerOrderId: row.provider_order_id,
      providerPaymentId: row.provider_payment_id,
      amountPaise: row.amount_paise,
      currency: row.currency,
    };
  }

  async claimWebhookEvent(event: {
    provider: "razorpay";
    eventId: string;
    eventType: string;
    payloadSha256: string;
  }): Promise<boolean> {
    const { error } = await this.supabase
      .from("payment_webhook_events")
      .insert({
        provider: event.provider,
        event_id: event.eventId,
        event_type: event.eventType,
        payload_sha256: event.payloadSha256,
      });
    if (!error) return true;
    if (error.code !== UNIQUE_VIOLATION) {
      throw new StoreError("payment_webhook_events.insert", error);
    }

    // Seen before. If that delivery never finished processing (the server
    // died mid-way), let this one run: recording a payment is idempotent.
    const { data, error: readError } = await this.supabase
      .from("payment_webhook_events")
      .select("processed_at")
      .eq("provider", event.provider)
      .eq("event_id", event.eventId)
      .maybeSingle();
    if (readError)
      throw new StoreError("payment_webhook_events.select", readError);
    return data?.processed_at == null;
  }

  async completeWebhookEvent(
    provider: "razorpay",
    eventId: string,
    outcome: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString(), outcome })
      .eq("provider", provider)
      .eq("event_id", eventId);
    if (error) throw new StoreError("payment_webhook_events.update", error);
  }
}

export class StoreError extends Error {
  readonly code: string | undefined;

  constructor(operation: string, cause: { code?: string; message: string }) {
    super(`${operation} failed: ${cause.message}`);
    this.name = "StoreError";
    this.code = cause.code;
  }
}
