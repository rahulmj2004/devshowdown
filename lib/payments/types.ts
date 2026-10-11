export interface GatewayOrder {
  id: string;
  amountPaise: number;
  currency: string;
}

export interface GatewayPayment {
  id: string;
  orderId: string | null;
  amountPaise: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string | null;
}

/**
 * The slice of a payment provider the registration service depends on.
 * Tests supply a fake; production supplies Razorpay.
 */
export interface PaymentGateway {
  /** Publishable key id. The only credential that may reach the browser. */
  readonly keyId: string;
  readonly webhookConfigured: boolean;
  createOrder(input: {
    amountPaise: number;
    currency: "INR";
    receipt: string;
  }): Promise<GatewayOrder>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
}
