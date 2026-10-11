import type { CheckoutSession } from "@/lib/registration/service";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: () => void): void;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact?: string };
  theme: { color: string };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Loads Razorpay's hosted Checkout script once, on first use. */
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Could not load Razorpay Checkout"));
    };
    document.head.append(script);
  });
  return loading;
}

export type CheckoutOutcome =
  /** Checkout reported success. This is a claim to verify, not a fact. */
  | { kind: "completed"; response: RazorpaySuccess }
  /** The participant closed the window. `attemptFailed` if a payment failed first. */
  | { kind: "dismissed"; attemptFailed: boolean };

/**
 * Opens Razorpay Checkout for an order the server created. Card and UPI
 * details are entered inside Razorpay's own frame: they never pass through
 * this site. Resolves when the window closes, one way or the other.
 */
export async function openRazorpayCheckout(
  session: Extract<CheckoutSession, { mode: "razorpay" }>,
  details: { siteName: string; reference: string },
): Promise<CheckoutOutcome> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Razorpay Checkout is unavailable");

  return new Promise<CheckoutOutcome>((resolve) => {
    let attemptFailed = false;
    const checkout = new Razorpay({
      key: session.keyId,
      order_id: session.orderId,
      amount: session.amountPaise,
      currency: session.currency,
      name: details.siteName,
      description: `Registration ${details.reference}`,
      prefill: session.prefill,
      theme: { color: "#7b3dff" },
      handler: (response) => resolve({ kind: "completed", response }),
      modal: {
        ondismiss: () => resolve({ kind: "dismissed", attemptFailed }),
      },
    });
    // Razorpay keeps its window open after a failed attempt so the
    // participant can try another method; remember that it happened.
    checkout.on("payment.failed", () => {
      attemptFailed = true;
    });
    checkout.open();
  });
}
