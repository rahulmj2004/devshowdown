import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** Constant-time comparison of two hex digests. */
function safeEqualHex(expected: string, received: string): boolean {
  if (!/^[a-f0-9]+$/i.test(received)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Razorpay Checkout returns `razorpay_signature`, an HMAC-SHA256 of
 * "<order_id>|<payment_id>" keyed with the account's key secret. The order id
 * passed here must be the one the server stored, never the one the browser
 * sent back.
 */
export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!input.keySecret) return false;
  const expected = hmacHex(
    input.keySecret,
    `${input.orderId}|${input.paymentId}`,
  );
  return safeEqualHex(expected, input.signature);
}

/**
 * Razorpay signs each webhook with HMAC-SHA256 of the exact raw request body,
 * keyed with the webhook secret, sent in `X-Razorpay-Signature`.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  webhookSecret: string;
}): boolean {
  if (!input.signature || !input.webhookSecret) return false;
  return safeEqualHex(
    hmacHex(input.webhookSecret, input.rawBody),
    input.signature,
  );
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
