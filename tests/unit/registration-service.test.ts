import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { events as configuredEvents } from "@/config/events";
import {
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/lib/payments/signature";
import type { GatewayPayment, PaymentGateway } from "@/lib/payments/types";
import { MemoryRegistrationStore } from "@/lib/registration/memory-store";
import {
  completeMockPayment,
  confirmCheckout,
  createRegistration,
  getRegistration,
  handleRazorpayWebhook,
  reviewUpiPayment,
  startPayment,
  submitUpiPayment,
  type RegistrationContext,
} from "@/lib/registration/service";
import type { EventConfig } from "@/types";

const KEY_SECRET = "key-secret";
const WEBHOOK_SECRET = "webhook-secret";
const keyOf = (character: string) => character.repeat(64);

const sign = (secret: string, message: string) =>
  createHmac("sha256", secret).update(message).digest("hex");

/** Events with confirmed fees: ₹100 solo, ₹200 for a team of 2-3. */
const events: EventConfig[] = [
  { ...configuredEvents[0], slug: "solo", title: "Solo Event", fee: 100 },
  {
    ...configuredEvents[1],
    slug: "team",
    title: "Team Event",
    fee: 200,
    team: { min: 2, max: 3 },
  },
  { ...configuredEvents[2], slug: "free", title: "Free Event", fee: null },
];

/** Stands in for Razorpay. Signatures are real; the network is not. */
function fakeGateway() {
  const payments = new Map<string, GatewayPayment>();
  let orderCount = 0;
  const gateway: PaymentGateway & {
    payments: Map<string, GatewayPayment>;
    createOrder: ReturnType<typeof vi.fn<PaymentGateway["createOrder"]>>;
  } = {
    keyId: "rzp_test_key",
    webhookConfigured: true,
    payments,
    createOrder: vi.fn(async ({ amountPaise, currency }) => ({
      id: `order_${++orderCount}`,
      amountPaise,
      currency,
    })),
    async fetchPayment(paymentId) {
      const payment = payments.get(paymentId);
      if (!payment) throw new Error("no such payment");
      return payment;
    },
    verifyCheckoutSignature: (input) =>
      verifyCheckoutSignature({ ...input, keySecret: KEY_SECRET }),
    verifyWebhookSignature: (rawBody, signature) =>
      verifyWebhookSignature({
        rawBody,
        signature,
        webhookSecret: WEBHOOK_SECRET,
      }),
  };
  return gateway;
}

function makeContext(
  overrides: Partial<RegistrationContext> = {},
): RegistrationContext & {
  gateway: ReturnType<typeof fakeGateway>;
  onConfirmed: ReturnType<
    typeof vi.fn<NonNullable<RegistrationContext["onConfirmed"]>>
  >;
} {
  return {
    store: new MemoryRegistrationStore(),
    gateway: fakeGateway(),
    paymentMode: "razorpay",
    paymentUnavailableReason: null,
    events,
    registrationStatus: "open",
    phoneField: "optional",
    allowMultipleEvents: true,
    devFeeOverride: undefined,
    onConfirmed: vi.fn(async () => {}),
    ...overrides,
  } as never;
}

const form = (overrides: Record<string, unknown> = {}) => ({
  fullName: "Asha Menon",
  email: "asha@example.com",
  organization: "Example College",
  phone: "",
  eventSlugs: ["solo"],
  teams: {},
  agree: true,
  clientKey: keyOf("a"),
  ...overrides,
});

async function register(
  context: RegistrationContext,
  overrides: Record<string, unknown> = {},
) {
  const values = form(overrides);
  const response = await createRegistration(context, values);
  if (response.status !== "created") {
    throw new Error(`expected a registration, got ${response.status}`);
  }
  return {
    registration: response.registration,
    access: {
      reference: response.registration.reference,
      clientKey: values.clientKey as string,
    },
  };
}

async function openOrder(context: RegistrationContext, access: unknown) {
  const started = await startPayment(context, access);
  if (started.status !== "ready" || started.checkout.mode !== "razorpay") {
    throw new Error(`expected a Razorpay checkout, got ${started.status}`);
  }
  return started.checkout;
}

function checkoutProof(orderId: string, paymentId: string) {
  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: sign(KEY_SECRET, `${orderId}|${paymentId}`),
  };
}

function webhook(
  event: string,
  entity: Record<string, unknown>,
  eventId: string | null = "evt_1",
) {
  const rawBody = JSON.stringify({ event, payload: { payment: { entity } } });
  return { rawBody, signature: sign(WEBHOOK_SECRET, rawBody), eventId };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/* ----------------------------------------------------------------- create */

describe("createRegistration", () => {
  it("confirms a registration with nothing to pay straight away", async () => {
    const context = makeContext();
    const { registration } = await register(context, { eventSlugs: ["free"] });

    expect(registration).toMatchObject({
      status: "confirmed",
      paymentStatus: "not_required",
      amountPaise: 0,
      testPayment: false,
    });
    expect(registration.reference).toMatch(/^DEMO-[A-Z0-9]{8}$/);
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("stores a registration with a fee as pending, never as paid", async () => {
    const context = makeContext();
    const { registration } = await register(context);
    expect(registration).toMatchObject({
      status: "pending_payment",
      paymentStatus: "pending",
      amountPaise: 10_000,
    });
    expect(context.onConfirmed).not.toHaveBeenCalled();
  });

  it("works the total out on the server and ignores any amount sent by the browser", async () => {
    const context = makeContext();
    const { registration } = await register(context, {
      eventSlugs: ["solo", "team"],
      teams: { team: { teamName: "Null Pointers", members: ["Ravi Kumar"] } },
      amountPaise: 1,
      feePaise: 1,
      entries: [{ eventSlug: "solo", feePaise: 1 }],
    });
    expect(registration.amountPaise).toBe(30_000);
    expect(registration.entries.map((entry) => entry.feePaise)).toEqual([
      10_000, 20_000,
    ]);
  });

  it("returns field errors without storing anything when input is invalid", async () => {
    const context = makeContext();
    const response = await createRegistration(
      context,
      form({ email: "nope", eventSlugs: ["team"] }),
    );
    expect(response).toMatchObject({
      status: "invalid",
      fieldErrors: {
        email: "Enter a valid email address.",
        "teams.team.teamName": "Enter a team name.",
      },
    });
  });

  it("refuses everything while registration is not open", async () => {
    for (const registrationStatus of ["not_open", "closed"] as const) {
      const response = await createRegistration(
        makeContext({ registrationStatus }),
        form(),
      );
      expect(response).toEqual({ status: "closed" });
    }
  });

  it("refuses an event the organizer has switched off", async () => {
    const context = makeContext({
      events: events.map((event) =>
        event.slug === "solo"
          ? { ...event, registrationEnabled: false }
          : event,
      ),
    });
    const response = await createRegistration(context, form());
    expect(response.status).toBe("invalid");
  });

  it("is idempotent: a double submit returns the same registration", async () => {
    const context = makeContext();
    const first = await register(context);
    const second = await register(context);
    expect(second.registration.reference).toBe(first.registration.reference);
  });

  it("rejects a second entry once the first is confirmed", async () => {
    const context = makeContext();
    await register(context, { eventSlugs: ["free"] });
    const response = await createRegistration(
      context,
      form({ eventSlugs: ["free", "solo"], clientKey: keyOf("b") }),
    );
    expect(response).toEqual({
      status: "duplicate",
      eventTitles: ["Free Event"],
    });
  });

  it("lets a fresh attempt replace one that was never paid", async () => {
    const context = makeContext();
    const abandoned = await register(context);
    const retry = await register(context, { clientKey: keyOf("b") });

    expect(retry.registration.reference).not.toBe(
      abandoned.registration.reference,
    );
    expect((await getRegistration(context, abandoned.access))?.status).toBe(
      "superseded",
    );
  });

  it("will not create a paid registration when payment is not configured", async () => {
    const context = makeContext({
      paymentMode: "unconfigured",
      gateway: null,
      paymentUnavailableReason: "Razorpay keys have not been configured.",
    });
    expect(await createRegistration(context, form())).toEqual({
      status: "payments_unavailable",
      reason: "Razorpay keys have not been configured.",
    });
    // Free entries are unaffected.
    const free = await createRegistration(
      context,
      form({ eventSlugs: ["free"] }),
    );
    expect(free.status).toBe("created");
  });

  it("flags mock-gateway registrations as test payments", async () => {
    const context = makeContext({ paymentMode: "mock", gateway: null });
    const { registration } = await register(context);
    expect(registration.testPayment).toBe(true);
  });
});

/* ----------------------------------------------------------------- lookup */

describe("getRegistration", () => {
  it("needs both the reference and the browser key", async () => {
    const context = makeContext();
    const { access } = await register(context);

    expect(await getRegistration(context, access)).not.toBeNull();
    expect(
      await getRegistration(context, { ...access, clientKey: keyOf("f") }),
    ).toBeNull();
    expect(
      await getRegistration(context, { reference: access.reference }),
    ).toBeNull();
  });

  it("never exposes contact details beyond the name and email", async () => {
    const context = makeContext();
    const { access } = await register(context, { phone: "9876543210" });
    const summary = await getRegistration(context, access);
    expect(JSON.stringify(summary)).not.toContain("9876543210");
    expect(JSON.stringify(summary)).not.toContain("Example College");
  });
});

/* ---------------------------------------------------------------- payment */

describe("startPayment", () => {
  it("creates the order for the stored amount and exposes only the key id", async () => {
    const context = makeContext();
    const { access } = await register(context);
    const checkout = await openOrder(context, access);

    expect(checkout).toMatchObject({
      keyId: "rzp_test_key",
      amountPaise: 10_000,
      currency: "INR",
      prefill: { name: "Asha Menon", email: "asha@example.com" },
    });
    expect(JSON.stringify(checkout)).not.toContain(KEY_SECRET);
    expect(context.gateway.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 10_000, currency: "INR" }),
    );
  });

  it("reuses the same order on retry, so nobody can be charged twice", async () => {
    const context = makeContext();
    const { access } = await register(context);
    const first = await openOrder(context, access);
    const second = await openOrder(context, access);
    const third = await openOrder(context, access);

    expect(second.orderId).toBe(first.orderId);
    expect(third.orderId).toBe(first.orderId);
    expect(context.gateway.createOrder).toHaveBeenCalledTimes(1);
  });

  it("does not open checkout for an unknown registration or a wrong key", async () => {
    const context = makeContext();
    const { access } = await register(context);
    expect(
      await startPayment(context, { ...access, clientKey: keyOf("f") }),
    ).toEqual({ status: "not_found" });
    expect(context.gateway.createOrder).not.toHaveBeenCalled();
  });

  it("has nothing to charge for a free registration", async () => {
    const context = makeContext();
    const { access } = await register(context, { eventSlugs: ["free"] });
    const started = await startPayment(context, access);
    expect(started.status).toBe("settled");
    expect(context.gateway.createOrder).not.toHaveBeenCalled();
  });
});

describe("confirmCheckout", () => {
  async function pendingPayment(
    status: GatewayPayment["status"],
    amount = 10_000,
  ) {
    const context = makeContext();
    const { access } = await register(context);
    const checkout = await openOrder(context, access);
    context.gateway.payments.set("pay_1", {
      id: "pay_1",
      orderId: checkout.orderId,
      amountPaise: amount,
      currency: "INR",
      status,
      method: "upi",
    });
    return { context, access, checkout };
  }

  it("confirms only after the signature and the gateway's own status agree", async () => {
    const { context, access, checkout } = await pendingPayment("captured");
    const response = await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );

    expect(response).toMatchObject({
      status: "settled",
      registration: {
        status: "confirmed",
        paymentStatus: "paid",
        paymentReference: "pay_1",
      },
    });
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("ignores a browser that simply claims success", async () => {
    const { context, access, checkout } = await pendingPayment("captured");
    const forged = {
      razorpay_order_id: checkout.orderId,
      razorpay_payment_id: "pay_1",
      razorpay_signature: "0".repeat(64),
    };
    expect((await confirmCheckout(context, access, forged)).status).toBe(
      "rejected",
    );
    expect((await confirmCheckout(context, access, {})).status).toBe(
      "rejected",
    );
    expect(
      (await confirmCheckout(context, access, { paid: true })).status,
    ).toBe("rejected");

    expect(await getRegistration(context, access)).toMatchObject({
      status: "pending_payment",
      paymentStatus: "pending",
    });
    expect(context.onConfirmed).not.toHaveBeenCalled();
  });

  it("rejects a valid signature replayed against another registration's order", async () => {
    const { context, checkout } = await pendingPayment("captured");
    const other = await register(context, {
      email: "other@example.com",
      clientKey: keyOf("c"),
    });
    await openOrder(context, other.access);

    const response = await confirmCheckout(
      context,
      other.access,
      checkoutProof(checkout.orderId, "pay_1"),
    );
    expect(response.status).toBe("rejected");
    expect((await getRegistration(context, other.access))?.paymentStatus).toBe(
      "pending",
    );
  });

  it("does not confirm when the gateway says the payment failed", async () => {
    const { context, access, checkout } = await pendingPayment("failed");
    const response = await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );
    expect(response).toMatchObject({
      status: "settled",
      registration: { status: "pending_payment", paymentStatus: "failed" },
    });
    expect(context.onConfirmed).not.toHaveBeenCalled();
  });

  it("holds an authorized-but-uncaptured payment for verification", async () => {
    const { context, access, checkout } = await pendingPayment("authorized");
    const response = await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );
    expect(response).toMatchObject({
      registration: {
        status: "pending_payment",
        paymentStatus: "verification_required",
      },
    });
    // Once verification is pending, the participant is not asked to pay again.
    expect((await startPayment(context, access)).status).toBe("settled");
  });

  it("refuses to treat a different amount as payment", async () => {
    const { context, access, checkout } = await pendingPayment("captured", 100);
    const response = await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );
    expect(response).toMatchObject({
      registration: {
        status: "pending_payment",
        paymentStatus: "verification_required",
        paymentReference: null,
      },
    });
    expect(context.onConfirmed).not.toHaveBeenCalled();
  });

  it("reports an error, not success, when the gateway cannot be reached", async () => {
    const { context, access, checkout } = await pendingPayment("captured");
    context.gateway.payments.clear();
    const response = await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );
    expect(response).toEqual({ status: "error" });
    expect((await getRegistration(context, access))?.status).toBe(
      "pending_payment",
    );
  });

  it("allows a retry after a failure and settles once", async () => {
    const { context, access, checkout } = await pendingPayment("failed");
    await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );

    const retry = await openOrder(context, access);
    expect(retry.orderId).toBe(checkout.orderId);
    context.gateway.payments.set("pay_2", {
      id: "pay_2",
      orderId: retry.orderId,
      amountPaise: 10_000,
      currency: "INR",
      status: "captured",
      method: "card",
    });

    const proof = checkoutProof(retry.orderId, "pay_2");
    const first = await confirmCheckout(context, access, proof);
    const again = await confirmCheckout(context, access, proof);

    expect(first).toMatchObject({ registration: { paymentStatus: "paid" } });
    expect(again).toMatchObject({ registration: { paymentStatus: "paid" } });
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------- mock */

describe("mock payments", () => {
  it("cannot be used to mark a registration paid outside mock mode", async () => {
    const context = makeContext();
    const { access } = await register(context);
    await openOrder(context, access);

    expect(await completeMockPayment(context, access, "success")).toEqual({
      status: "error",
    });
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "pending",
    );
  });

  it("walks failure, retry and success, always labelled as a test payment", async () => {
    const context = makeContext({ paymentMode: "mock", gateway: null });
    const { access } = await register(context);

    const started = await startPayment(context, access);
    expect(started).toMatchObject({
      status: "ready",
      checkout: { mode: "mock", amountPaise: 10_000 },
    });

    const failed = await completeMockPayment(context, access, "failure");
    expect(failed).toMatchObject({
      registration: { status: "pending_payment", paymentStatus: "failed" },
    });

    const paid = await completeMockPayment(context, access, "success");
    expect(paid).toMatchObject({
      registration: {
        status: "confirmed",
        paymentStatus: "paid",
        testPayment: true,
        demo: true,
      },
    });
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("applies the development fee override in mock mode only", async () => {
    const mock = makeContext({
      paymentMode: "mock",
      gateway: null,
      devFeeOverride: 50,
    });
    const real = makeContext({ devFeeOverride: 50 });

    expect(
      (await register(mock, { eventSlugs: ["free"] })).registration.amountPaise,
    ).toBe(5_000);
    expect(
      (await register(real, { eventSlugs: ["free"] })).registration.amountPaise,
    ).toBe(0);
  });
});

/* ---------------------------------------------------------------- webhook */

describe("direct UPI payments", () => {
  const upiContext = () =>
    makeContext({
      paymentMode: "upi",
      gateway: null,
      upi: { vpa: "rahul@okaxis", payeeName: "Rahul M J" },
    });

  async function reachUpi(
    context: RegistrationContext,
    overrides: Record<string, unknown> = {},
  ) {
    const created = await register(context, overrides);
    const started = await startPayment(context, created.access);
    if (started.status !== "ready" || started.checkout.mode !== "upi") {
      throw new Error(`expected a UPI checkout, got ${started.status}`);
    }
    return { ...created, checkout: started.checkout };
  }

  it("shows who to pay, the stored amount and the reference as the note", async () => {
    const context = upiContext();
    const { registration, checkout } = await reachUpi(context);

    expect(checkout).toEqual({
      mode: "upi",
      vpa: "rahul@okaxis",
      payeeName: "Rahul M J",
      amountPaise: 10000,
      currency: "INR",
      note: registration.reference,
    });
    expect(registration.testPayment).toBe(false);
  });

  it("treats a transaction ID as a claim: nothing is confirmed until reviewed", async () => {
    const context = upiContext();
    const { access } = await reachUpi(context);

    const response = await submitUpiPayment(context, access, {
      transactionId: "412345678901",
    });

    expect(response.status).toBe("settled");
    if (response.status !== "settled") return;
    expect(response.registration.status).toBe("pending_payment");
    expect(response.registration.paymentStatus).toBe("verification_required");
    expect(response.registration.paymentReference).toBeNull();
    expect(context.onConfirmed).not.toHaveBeenCalled();
  });

  it("refuses anything that is not a 12-digit transaction ID", async () => {
    const context = upiContext();
    const { access } = await reachUpi(context);

    for (const transactionId of [
      "",
      "12345",
      "41234567890a",
      "4123456789012",
    ]) {
      const response = await submitUpiPayment(context, access, {
        transactionId,
      });
      expect(response).toMatchObject({
        status: "rejected",
        reason: "invalid_transaction_id",
      });
    }
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "pending",
    );
  });

  it("confirms the registration once an organizer approves the claim", async () => {
    const context = upiContext();
    const { access, registration } = await reachUpi(context);
    await submitUpiPayment(context, access, { transactionId: "412345678901" });

    expect(
      await reviewUpiPayment(context, registration.reference, "approve"),
    ).toBe("approved");

    const latest = await getRegistration(context, access);
    expect(latest?.status).toBe("confirmed");
    expect(latest?.paymentStatus).toBe("paid");
    expect(latest?.paymentReference).toBe("412345678901");
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);

    // A second click on "Mark paid" finds nothing left to review.
    expect(
      await reviewUpiPayment(context, registration.reference, "approve"),
    ).toBe("nothing_to_review");
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("lets the participant enter a different ID after a rejection", async () => {
    const context = upiContext();
    const { access, registration } = await reachUpi(context);
    await submitUpiPayment(context, access, { transactionId: "412345678901" });

    expect(
      await reviewUpiPayment(context, registration.reference, "reject"),
    ).toBe("rejected");
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "failed",
    );
    expect(context.onConfirmed).not.toHaveBeenCalled();

    await submitUpiPayment(context, access, { transactionId: "498765432109" });
    expect(
      await reviewUpiPayment(context, registration.reference, "approve"),
    ).toBe("approved");
    expect((await getRegistration(context, access))?.paymentReference).toBe(
      "498765432109",
    );
  });

  it("will not accept one transaction ID for two registrations", async () => {
    const context = upiContext();
    const first = await reachUpi(context);
    const second = await reachUpi(context, {
      email: "ravi@example.com",
      clientKey: keyOf("b"),
    });
    await submitUpiPayment(context, first.access, {
      transactionId: "412345678901",
    });

    const reused = await submitUpiPayment(context, second.access, {
      transactionId: "412345678901",
    });

    expect(reused).toMatchObject({
      status: "rejected",
      reason: "transaction_id_in_use",
    });
    expect((await getRegistration(context, second.access))?.paymentStatus).toBe(
      "pending",
    );
    expect(
      await reviewUpiPayment(context, second.registration.reference, "approve"),
    ).toBe("nothing_to_review");
  });

  it("cannot be changed by the participant while a claim is under review", async () => {
    const context = upiContext();
    const { access, registration } = await reachUpi(context);
    await submitUpiPayment(context, access, { transactionId: "412345678901" });
    await submitUpiPayment(context, access, { transactionId: "498765432109" });

    await reviewUpiPayment(context, registration.reference, "approve");
    expect((await getRegistration(context, access))?.paymentReference).toBe(
      "412345678901",
    );
  });

  it("has nothing to review for a registration nobody has paid for", async () => {
    const context = upiContext();
    const { registration, access } = await reachUpi(context);

    expect(
      await reviewUpiPayment(context, registration.reference, "approve"),
    ).toBe("nothing_to_review");
    expect((await getRegistration(context, access))?.status).toBe(
      "pending_payment",
    );
  });

  it("cannot be used to report a payment outside UPI mode", async () => {
    const context = makeContext();
    const { access } = await register(context);
    await openOrder(context, access);

    expect(
      await submitUpiPayment(context, access, {
        transactionId: "412345678901",
      }),
    ).toEqual({ status: "error" });
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "pending",
    );
  });
});

describe("handleRazorpayWebhook", () => {
  async function awaitingWebhook() {
    const context = makeContext();
    const { access } = await register(context);
    const checkout = await openOrder(context, access);
    const entity = {
      id: "pay_1",
      order_id: checkout.orderId,
      amount: 10_000,
      currency: "INR",
      status: "captured",
      method: "upi",
    };
    return { context, access, checkout, entity };
  }

  it("rejects an unsigned or wrongly signed request without touching anything", async () => {
    const { context, access, entity } = await awaitingWebhook();
    const request = webhook("payment.captured", entity);

    for (const signature of [
      null,
      "",
      "0".repeat(64),
      sign("wrong", request.rawBody),
    ]) {
      const response = await handleRazorpayWebhook(context, {
        ...request,
        signature,
      });
      expect(response).toMatchObject({ http: 401, body: { ok: false } });
    }
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "pending",
    );
  });

  it("rejects a body that was modified after it was signed", async () => {
    const { context, entity } = await awaitingWebhook();
    const request = webhook("payment.captured", entity);
    const tampered = request.rawBody.replace("10000", "1");
    expect(
      (await handleRazorpayWebhook(context, { ...request, rawBody: tampered }))
        .http,
    ).toBe(401);
  });

  it("confirms the registration from a signed payment.captured event", async () => {
    const { context, access, entity } = await awaitingWebhook();
    const response = await handleRazorpayWebhook(
      context,
      webhook("payment.captured", entity),
    );

    expect(response).toEqual({
      http: 200,
      body: { ok: true, result: "confirmed" },
    });
    expect(await getRegistration(context, access)).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
      paymentReference: "pay_1",
    });
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a redelivered event without applying it twice", async () => {
    const { context, entity } = await awaitingWebhook();
    const recordPayment = vi.spyOn(context.store, "recordPayment");
    const request = webhook("payment.captured", entity, "evt_same");

    const first = await handleRazorpayWebhook(context, request);
    const second = await handleRazorpayWebhook(context, request);
    const third = await handleRazorpayWebhook(context, request);

    expect(first.body.result).toBe("confirmed");
    expect(second).toEqual({
      http: 200,
      body: { ok: true, result: "duplicate" },
    });
    expect(third.body.result).toBe("duplicate");
    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("stays idempotent when the same payment arrives under different event ids", async () => {
    const { context, entity } = await awaitingWebhook();
    await handleRazorpayWebhook(
      context,
      webhook("payment.captured", entity, "evt_a"),
    );
    const again = await handleRazorpayWebhook(
      context,
      webhook("order.paid", entity, "evt_b"),
    );
    expect(again.body.result).toBe("already_confirmed");
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("retries a delivery whose first attempt crashed mid-way", async () => {
    const { context, access, entity } = await awaitingWebhook();
    const request = webhook("payment.captured", entity, "evt_crash");
    vi.spyOn(context.store, "recordPayment").mockRejectedValueOnce(
      new Error("database went away"),
    );

    await expect(handleRazorpayWebhook(context, request)).rejects.toThrow();
    expect((await getRegistration(context, access))?.status).toBe(
      "pending_payment",
    );

    const retry = await handleRazorpayWebhook(context, request);
    expect(retry.body.result).toBe("confirmed");
  });

  it("settles correctly whichever of webhook and checkout arrives first", async () => {
    const { context, access, checkout, entity } = await awaitingWebhook();
    context.gateway.payments.set("pay_1", {
      id: "pay_1",
      orderId: checkout.orderId,
      amountPaise: 10_000,
      currency: "INR",
      status: "captured",
      method: "upi",
    });

    await handleRazorpayWebhook(context, webhook("payment.captured", entity));
    const fromBrowser = await confirmCheckout(
      context,
      access,
      checkoutProof(checkout.orderId, "pay_1"),
    );

    expect(fromBrowser).toMatchObject({
      status: "settled",
      registration: { status: "confirmed", paymentStatus: "paid" },
    });
    expect(context.onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("does not let a late failure event undo a confirmed payment", async () => {
    const { context, access, entity } = await awaitingWebhook();
    await handleRazorpayWebhook(
      context,
      webhook("payment.captured", entity, "evt_a"),
    );
    const late = await handleRazorpayWebhook(
      context,
      webhook(
        "payment.failed",
        { ...entity, id: "pay_0", status: "failed" },
        "evt_b",
      ),
    );
    expect(late.body.result).toBe("already_confirmed");
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "paid",
    );
  });

  it("marks a failed payment as failed and leaves the order open for retry", async () => {
    const { context, access, checkout, entity } = await awaitingWebhook();
    const response = await handleRazorpayWebhook(
      context,
      webhook("payment.failed", { ...entity, status: "failed" }),
    );
    expect(response.body.result).toBe("failed");
    expect((await getRegistration(context, access))?.paymentStatus).toBe(
      "failed",
    );
    expect((await openOrder(context, access)).orderId).toBe(checkout.orderId);
  });

  it("flags a captured amount that does not match the order", async () => {
    const { context, access, entity } = await awaitingWebhook();
    const response = await handleRazorpayWebhook(
      context,
      webhook("payment.captured", { ...entity, amount: 500 }),
    );
    expect(response.body.result).toBe("verification_required");
    expect(await getRegistration(context, access)).toMatchObject({
      status: "pending_payment",
      paymentStatus: "verification_required",
    });
  });

  it("flags money that arrives for a registration that was replaced", async () => {
    const { context, access, entity } = await awaitingWebhook();
    await register(context, { clientKey: keyOf("b") });

    const response = await handleRazorpayWebhook(
      context,
      webhook("payment.captured", entity),
    );
    expect(response.body.result).toBe("verification_required");
    expect(await getRegistration(context, access)).toMatchObject({
      status: "superseded",
      paymentStatus: "verification_required",
    });
    expect(context.onConfirmed).not.toHaveBeenCalled();
  });

  it("acknowledges events it does not act on, and unknown orders", async () => {
    const { context, entity } = await awaitingWebhook();
    expect(
      (
        await handleRazorpayWebhook(
          context,
          webhook("refund.created", entity, "e1"),
        )
      ).body.result,
    ).toBe("ignored");
    expect(
      (
        await handleRazorpayWebhook(
          context,
          webhook(
            "payment.captured",
            { ...entity, order_id: "order_nope" },
            "e2",
          ),
        )
      ).body.result,
    ).toBe("order_not_found");
  });

  it("answers 400 for signed but malformed bodies", async () => {
    const context = makeContext();
    const signed = (rawBody: string) => ({
      rawBody,
      signature: sign(WEBHOOK_SECRET, rawBody),
      eventId: "evt_bad",
    });
    expect(
      (await handleRazorpayWebhook(context, signed("not json"))).http,
    ).toBe(400);
    expect(
      (await handleRazorpayWebhook(context, signed('{"nope":1}'))).http,
    ).toBe(400);
  });

  it("is switched off entirely until a webhook secret is configured", async () => {
    const withoutSecret = makeContext();
    withoutSecret.gateway = {
      ...withoutSecret.gateway,
      webhookConfigured: false,
    };
    const mockMode = makeContext({ paymentMode: "mock", gateway: null });

    for (const context of [withoutSecret, mockMode]) {
      const response = await handleRazorpayWebhook(context, {
        rawBody: "{}",
        signature: sign(WEBHOOK_SECRET, "{}"),
        eventId: "evt",
      });
      expect(response.http).toBe(503);
    }
  });
});
