import "server-only";
import Razorpay from "razorpay";
import { verifyCheckoutSignature, verifyWebhookSignature } from "./signature";
import type { PaymentGateway } from "./types";

/**
 * Razorpay, through the official SDK. The key secret and webhook secret stay
 * inside this closure on the server; nothing here is serialisable to a client.
 */
export function createRazorpayGateway(config: {
  keyId: string;
  keySecret: string;
  webhookSecret: string | undefined;
}): PaymentGateway {
  const client = new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });

  return {
    keyId: config.keyId,
    webhookConfigured: Boolean(config.webhookSecret),

    async createOrder({ amountPaise, currency, receipt }) {
      const order = await client.orders.create({
        amount: amountPaise,
        currency,
        receipt,
        notes: { reference: receipt },
      });
      return {
        id: order.id,
        amountPaise: Number(order.amount),
        currency: order.currency,
      };
    },

    async fetchPayment(paymentId) {
      const payment = await client.payments.fetch(paymentId);
      return {
        id: payment.id,
        orderId: payment.order_id ?? null,
        amountPaise: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        method: payment.method ?? null,
      };
    },

    verifyCheckoutSignature({ orderId, paymentId, signature }) {
      return verifyCheckoutSignature({
        orderId,
        paymentId,
        signature,
        keySecret: config.keySecret,
      });
    },

    verifyWebhookSignature(rawBody, signature) {
      return verifyWebhookSignature({
        rawBody,
        signature,
        webhookSecret: config.webhookSecret ?? "",
      });
    },
  };
}
