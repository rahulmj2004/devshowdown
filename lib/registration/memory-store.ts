import type {
  CreateRegistrationResult,
  NewRegistration,
  RecordPaymentResult,
  RegistrationStore,
  StoredOrder,
  StoredRegistration,
  VerifiedPayment,
} from "./types";

interface MemoryRegistration extends StoredRegistration {
  clientKeyHash: string;
}

interface MemoryOrder extends StoredOrder {
  registrationId: string;
}

interface MemoryTransaction {
  registrationId: string;
  providerPaymentId: string;
  status: VerifiedPayment["status"];
}

/**
 * In-memory implementation of the registration store. It mirrors the rules of
 * the SQL functions in supabase/migrations/0002 so the same service code and
 * the same tests run against either. Nothing here is durable: it backs demo
 * mode (no database connected) and the test suite.
 */
export class MemoryRegistrationStore implements RegistrationStore {
  readonly kind = "memory" as const;

  private registrations = new Map<string, MemoryRegistration>();
  private orders: MemoryOrder[] = [];
  private transactions = new Map<string, MemoryTransaction>();
  private webhookEvents = new Map<string, { processed: boolean }>();
  private nextId = 1;

  private snapshot(registration: MemoryRegistration): StoredRegistration {
    const captured = [...this.transactions.values()]
      .reverse()
      .find(
        (transaction) =>
          transaction.registrationId === registration.id &&
          transaction.status === "captured",
      );
    // The key hash is deliberately left out of the copy.
    return structuredClone({
      id: registration.id,
      reference: registration.reference,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      amountPaise: registration.amountPaise,
      currency: registration.currency,
      isTest: registration.isTest,
      createdAt: registration.createdAt,
      confirmedAt: registration.confirmedAt,
      participant: registration.participant,
      entries: registration.entries,
      paymentReference: captured?.providerPaymentId ?? null,
    });
  }

  private byParticipant(email: string): MemoryRegistration[] {
    return [...this.registrations.values()].filter(
      (registration) => registration.participant.email === email,
    );
  }

  async createRegistration(
    input: NewRegistration,
  ): Promise<CreateRegistrationResult> {
    const replay = [...this.registrations.values()].find(
      (registration) => registration.clientKeyHash === input.clientKeyHash,
    );
    if (replay) {
      return { outcome: "existing", registration: this.snapshot(replay) };
    }

    const slugs = new Set(input.entries.map((entry) => entry.eventSlug));
    const mine = this.byParticipant(input.participant.email);

    const duplicates = mine
      .filter((registration) => registration.status === "confirmed")
      .flatMap((registration) => registration.entries)
      .map((entry) => entry.eventSlug)
      .filter((slug) => slugs.has(slug));
    if (duplicates.length > 0) {
      return {
        outcome: "duplicate",
        eventSlugs: [...new Set(duplicates)].sort(),
      };
    }

    // An unfinished earlier attempt for the same events gives way to this one.
    for (const registration of mine) {
      if (
        registration.status === "pending_payment" &&
        registration.entries.some((entry) => slugs.has(entry.eventSlug))
      ) {
        registration.status = "superseded";
      }
    }

    const free = input.amountPaise === 0;
    const now = new Date().toISOString();
    const registration: MemoryRegistration = {
      id: `mem-${this.nextId++}`,
      reference: input.reference,
      clientKeyHash: input.clientKeyHash,
      status: free ? "confirmed" : "pending_payment",
      paymentStatus: free ? "not_required" : "pending",
      amountPaise: input.amountPaise,
      currency: "INR",
      isTest: input.isTest,
      createdAt: now,
      confirmedAt: free ? now : null,
      participant: { ...input.participant },
      entries: structuredClone(input.entries),
      paymentReference: null,
    };
    this.registrations.set(registration.id, registration);
    return { outcome: "created", registration: this.snapshot(registration) };
  }

  async findRegistration(reference: string, clientKeyHash: string) {
    const match = [...this.registrations.values()].find(
      (registration) =>
        registration.reference === reference &&
        registration.clientKeyHash === clientKeyHash,
    );
    return match ? this.snapshot(match) : null;
  }

  async getOpenOrder(registrationId: string): Promise<StoredOrder | null> {
    const order = this.orders.find(
      (candidate) =>
        candidate.registrationId === registrationId &&
        candidate.status !== "failed",
    );
    return order ? toStoredOrder(order) : null;
  }

  async saveOrder(
    registrationId: string,
    order: Omit<StoredOrder, "status">,
  ): Promise<StoredOrder> {
    const existing = await this.getOpenOrder(registrationId);
    if (existing) return existing;
    const stored: MemoryOrder = { ...order, registrationId, status: "created" };
    this.orders.push(stored);
    return toStoredOrder(stored);
  }

  async recordPayment(payment: VerifiedPayment): Promise<RecordPaymentResult> {
    const order = this.orders.find(
      (candidate) =>
        candidate.provider === payment.provider &&
        candidate.providerOrderId === payment.providerOrderId,
    );
    if (!order) return { outcome: "order_not_found", registration: null };

    const registration = this.registrations.get(order.registrationId)!;
    const done = (outcome: RecordPaymentResult["outcome"]) => ({
      outcome,
      registration: this.snapshot(registration),
    });

    if (
      payment.status !== "failed" &&
      (payment.amountPaise !== order.amountPaise ||
        payment.currency.toUpperCase() !== order.currency)
    ) {
      if (registration.status !== "confirmed") {
        registration.paymentStatus = "verification_required";
      }
      return done("verification_required");
    }

    const key = `${payment.provider}:${payment.providerPaymentId}`;
    const previous = this.transactions.get(key);
    this.transactions.set(key, {
      registrationId: registration.id,
      providerPaymentId: payment.providerPaymentId,
      // A captured payment never goes backwards.
      status: previous?.status === "captured" ? "captured" : payment.status,
    });

    if (registration.status === "confirmed") return done("already_confirmed");

    if (payment.status === "failed") {
      if (
        registration.paymentStatus === "pending" ||
        registration.paymentStatus === "failed"
      ) {
        registration.paymentStatus = "failed";
      }
      return done("failed");
    }
    if (payment.status === "authorized") {
      registration.paymentStatus = "verification_required";
      return done("pending");
    }
    if (registration.status === "superseded") {
      registration.paymentStatus = "verification_required";
      return done("verification_required");
    }

    order.status = "paid";
    registration.status = "confirmed";
    registration.paymentStatus = "paid";
    registration.confirmedAt = new Date().toISOString();
    return done("confirmed");
  }

  async claimWebhookEvent(event: { provider: "razorpay"; eventId: string }) {
    const key = `${event.provider}:${event.eventId}`;
    const existing = this.webhookEvents.get(key);
    if (existing) return !existing.processed;
    this.webhookEvents.set(key, { processed: false });
    return true;
  }

  async completeWebhookEvent(provider: "razorpay", eventId: string) {
    const event = this.webhookEvents.get(`${provider}:${eventId}`);
    if (event) event.processed = true;
  }
}

function toStoredOrder(order: MemoryOrder): StoredOrder {
  return {
    provider: order.provider,
    providerOrderId: order.providerOrderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    status: order.status,
  };
}
