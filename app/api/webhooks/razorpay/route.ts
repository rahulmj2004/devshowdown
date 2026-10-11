import { getRegistrationContext } from "@/lib/registration/context";
import { handleRazorpayWebhook } from "@/lib/registration/service";

/**
 * Razorpay webhook endpoint. Configure it in the Razorpay dashboard as
 *   https://<your-domain>/api/webhooks/razorpay
 * with the events payment.captured, payment.failed, payment.authorized and
 * order.paid, and the secret stored in RAZORPAY_WEBHOOK_SECRET.
 *
 * The signature is computed over the raw bytes, so the body is read as text
 * and never re-serialised before verification.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const result = await handleRazorpayWebhook(await getRegistrationContext(), {
      rawBody,
      signature: request.headers.get("x-razorpay-signature"),
      eventId: request.headers.get("x-razorpay-event-id"),
    });
    return Response.json(result.body, {
      status: result.http,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // A 5xx tells Razorpay to deliver this event again later.
    console.error("[webhook] razorpay processing failed:", error);
    return Response.json(
      { ok: false, result: "error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
