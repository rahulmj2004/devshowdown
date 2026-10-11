import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  resolveFeePaise,
  resolvePaymentMode,
  rupeesToPaise,
} from "@/lib/payments/mode";
import {
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/lib/payments/signature";
import { buildUpiUri, resolveUpiPayee } from "@/lib/payments/upi";

const sign = (secret: string, message: string) =>
  createHmac("sha256", secret).update(message).digest("hex");

describe("verifyCheckoutSignature", () => {
  const keySecret = "key-secret";
  const orderId = "order_ABC";
  const paymentId = "pay_XYZ";
  const signature = sign(keySecret, `${orderId}|${paymentId}`);

  it("accepts the signature Razorpay produces for this order and payment", () => {
    expect(
      verifyCheckoutSignature({ orderId, paymentId, signature, keySecret }),
    ).toBe(true);
  });

  it("rejects a signature made for a different order", () => {
    expect(
      verifyCheckoutSignature({
        orderId: "order_OTHER",
        paymentId,
        signature,
        keySecret,
      }),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: sign("attacker", `${orderId}|${paymentId}`),
        keySecret,
      }),
    ).toBe(false);
  });

  it("rejects malformed, truncated and empty signatures", () => {
    for (const bad of ["", "zz", signature.slice(0, 10), `${signature}00`]) {
      expect(
        verifyCheckoutSignature({
          orderId,
          paymentId,
          signature: bad,
          keySecret,
        }),
      ).toBe(false);
    }
  });

  it("never passes when the secret is missing", () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: sign("", `${orderId}|${paymentId}`),
        keySecret: "",
      }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const webhookSecret = "whsec";
  const rawBody = '{"event":"payment.captured"}';

  it("accepts a signature over the exact raw body", () => {
    expect(
      verifyWebhookSignature({
        rawBody,
        signature: sign(webhookSecret, rawBody),
        webhookSecret,
      }),
    ).toBe(true);
  });

  it("rejects a body that was altered after signing, even by whitespace", () => {
    expect(
      verifyWebhookSignature({
        rawBody: '{"event": "payment.captured"}',
        signature: sign(webhookSecret, rawBody),
        webhookSecret,
      }),
    ).toBe(false);
  });

  it("rejects a missing signature header or an unset secret", () => {
    expect(
      verifyWebhookSignature({ rawBody, signature: null, webhookSecret }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        rawBody,
        signature: sign("", rawBody),
        webhookSecret: "",
      }),
    ).toBe(false);
  });
});

describe("resolvePaymentMode", () => {
  const keys = { keyId: "rzp_test_abc", keySecret: "s" };

  it("uses the mock gateway in demo mode, where nothing is real", () => {
    expect(
      resolvePaymentMode({
        hasDatabase: false,
        keyId: undefined,
        keySecret: undefined,
        requested: undefined,
      }).mode,
    ).toBe("mock");
  });

  it("refuses paid registrations when a database exists but keys do not", () => {
    const result = resolvePaymentMode({
      hasDatabase: true,
      keyId: undefined,
      keySecret: undefined,
      requested: undefined,
    });
    expect(result.mode).toBe("unconfigured");
    expect(result.reason).toMatch(/Razorpay keys/);
  });

  it("uses Razorpay once keys and a database are both present", () => {
    expect(
      resolvePaymentMode({ hasDatabase: true, ...keys, requested: undefined })
        .mode,
    ).toBe("razorpay");
  });

  it("never takes live payments that could not be recorded", () => {
    const live = { keyId: "rzp_live_abc", keySecret: "s" };
    expect(
      resolvePaymentMode({ hasDatabase: false, ...live, requested: undefined })
        .mode,
    ).toBe("unconfigured");
    // Test keys are harmless, so they are allowed without a database.
    expect(
      resolvePaymentMode({ hasDatabase: false, ...keys, requested: undefined })
        .mode,
    ).toBe("razorpay");
  });

  it("takes direct UPI payments once a UPI ID and a database are both present", () => {
    const none = { keyId: undefined, keySecret: undefined };
    expect(
      resolvePaymentMode({
        hasDatabase: true,
        ...none,
        hasUpiPayee: true,
        requested: undefined,
      }).mode,
    ).toBe("upi");
    // Razorpay, when configured, takes priority over direct UPI.
    expect(
      resolvePaymentMode({
        hasDatabase: true,
        ...keys,
        hasUpiPayee: true,
        requested: undefined,
      }).mode,
    ).toBe("razorpay");
  });

  it("never shows a UPI ID in production when payments could not be recorded", () => {
    const input = {
      hasDatabase: false,
      keyId: undefined,
      keySecret: undefined,
      hasUpiPayee: true,
      requested: undefined,
    };
    const production = resolvePaymentMode({ ...input, allowUpiPreview: false });
    expect(production.mode).toBe("unconfigured");
    expect(production.reason).toMatch(/no database/);
    // Outside production the screens can be previewed in demo mode.
    expect(resolvePaymentMode({ ...input, allowUpiPreview: true }).mode).toBe(
      "upi",
    );
  });

  it("lets PAYMENT_MODE=mock override real keys", () => {
    expect(
      resolvePaymentMode({ hasDatabase: true, ...keys, requested: "mock" })
        .mode,
    ).toBe("mock");
  });
});

describe("fees", () => {
  it("charges nothing while a fee is unconfirmed", () => {
    expect(resolveFeePaise(null, "razorpay", undefined)).toBe(0);
    expect(resolveFeePaise(null, "unconfigured", undefined)).toBe(0);
  });

  it("converts a confirmed fee from rupees to paise", () => {
    expect(rupeesToPaise(150)).toBe(15000);
    expect(resolveFeePaise(150, "razorpay", undefined)).toBe(15000);
  });

  it("applies the development override to the mock gateway only", () => {
    expect(resolveFeePaise(null, "mock", 50)).toBe(5000);
    expect(resolveFeePaise(null, "razorpay", 50)).toBe(0);
    expect(resolveFeePaise(150, "razorpay", 50)).toBe(15000);
  });
});

describe("UPI", () => {
  it("is off until both a well-formed UPI ID and a payee name are set", () => {
    expect(resolveUpiPayee({ vpa: null, payeeName: null })).toBeNull();
    expect(
      resolveUpiPayee({ vpa: "rahul@okaxis", payeeName: null }),
    ).toBeNull();
    expect(
      resolveUpiPayee({ vpa: "not a upi id", payeeName: "Rahul M J" }),
    ).toBeNull();
    expect(
      resolveUpiPayee({ vpa: " rahul.mj-1@okaxis ", payeeName: "Rahul M J" }),
    ).toEqual({ vpa: "rahul.mj-1@okaxis", payeeName: "Rahul M J" });
  });

  it("builds a payment link with a fixed amount and the reference as the note", () => {
    expect(
      buildUpiUri({
        vpa: "rahul@okaxis",
        payeeName: "Rahul M J",
        amountPaise: 15050,
        note: "DSD-7K2M9QXA",
      }),
    ).toBe(
      "upi://pay?pa=rahul@okaxis&pn=Rahul%20M%20J&am=150.50&cu=INR&tn=DSD-7K2M9QXA",
    );
  });
});
