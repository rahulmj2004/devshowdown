import "server-only";
import { siteConfig } from "@/config/site";
import { env, siteUrl } from "@/lib/env";
import type { StoredRegistration } from "@/lib/registration/types";
import { getEventBySlug } from "@/config/events";
import { formatPaise } from "@/lib/utils";

/** Confirmation emails are sent only when both variables are configured. */
export const isEmailConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function buildConfirmationEmail(registration: StoredRegistration) {
  const events = registration.entries.map(
    (entry) => getEventBySlug(entry.eventSlug)?.title ?? entry.eventSlug,
  );
  const payment =
    registration.paymentStatus === "paid"
      ? `${formatPaise(registration.amountPaise)} received${
          registration.paymentReference
            ? ` (payment reference ${registration.paymentReference})`
            : ""
        }${registration.isTest ? " — SIMULATED TEST PAYMENT, no money moved" : ""}`
      : "No payment was required";

  const lines = [
    `Hi ${registration.participant.fullName},`,
    "",
    `Your ${siteConfig.name} registration is confirmed.`,
    "",
    `Registration reference: ${registration.reference}`,
    `Competitions: ${events.join(", ")}`,
    `Payment: ${payment}`,
    "",
    `Schedule and venue announcements are published at ${siteUrl}.`,
    "Keep this email: you may be asked for your reference at check-in.",
  ];

  return {
    subject: `${siteConfig.name} registration confirmed (${registration.reference})`,
    text: lines.join("\n"),
    html: lines
      .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : ""))
      .join(""),
  };
}

/**
 * Sends the confirmation through Resend's HTTP API. Does nothing when email
 * is not configured. Throws on a delivery failure; the caller logs it and
 * carries on, because the registration is already confirmed either way.
 */
export async function sendConfirmationEmail(
  registration: StoredRegistration,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return;

  const message = buildConfirmationEmail(registration);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Lets Resend drop an accidental second send for the same registration.
      "Idempotency-Key": `registration-confirmed/${registration.reference}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [registration.participant.email],
      ...message,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}`);
  }
}
