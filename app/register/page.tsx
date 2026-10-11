import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  RegistrationFlow,
  RegistrationFlowSkeleton,
  type FlowEvent,
} from "@/components/registration/registration-flow";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { getEventBySlug, getEvents } from "@/config/events";
import { registrationStatusCopy, siteConfig } from "@/config/site";
import { getSiteSettings } from "@/lib/data/settings";
import { isEmailConfigured } from "@/lib/email";
import { env } from "@/lib/env";
import { resolveFeePaise } from "@/lib/payments/mode";
import { isDemoMode, payment } from "@/lib/registration/context";
import { isEventRegistrationOpen } from "@/lib/registration-status";
import type { PaymentMode, RegistrationStatus } from "@/types";

export const metadata: Metadata = {
  title: "Register",
  description: "Register for a DevShowdown competition.",
  alternates: { canonical: "/register" },
};

const statusTone: Record<RegistrationStatus, BadgeTone> = {
  not_open: "neutral",
  open: "success",
  closed: "warn",
};

const steps = [
  "Choose your competitions",
  "Enter your details",
  "Review the summary and any fee",
  "Pay securely, if a fee applies",
  "Get your registration reference",
];

const paymentLabel: Record<PaymentMode, { text: string; tone: BadgeTone }> = {
  razorpay: { text: "Razorpay", tone: "success" },
  mock: { text: "Mock gateway (no real money)", tone: "warn" },
  unconfigured: { text: "Not configured", tone: "neutral" },
};

/** Reads `?event=` inside Suspense so the rest of the page stays static. */
async function FlowWithPreselection({
  searchParams,
}: Pick<PageProps<"/register">, "searchParams">) {
  const [{ event: requested }, settings] = await Promise.all([
    searchParams,
    getSiteSettings(),
  ]);
  const requestedSlug = typeof requested === "string" ? requested : undefined;

  // Fees shown here are for display. The server works them out again from
  // its own configuration when the registration is submitted.
  const events: FlowEvent[] = getEvents().map((event) => ({
    slug: event.slug,
    title: event.title,
    tagline: event.tagline,
    accent: event.accent,
    icon: event.icon,
    open: isEventRegistrationOpen(event, settings.registrationStatus),
    team: event.team,
    feePaise: resolveFeePaise(
      event.fee,
      payment.mode,
      env.DEV_FEE_OVERRIDE_INR,
    ),
    feeConfirmed: event.fee !== null,
  }));

  return (
    <RegistrationFlow
      events={events}
      config={{
        siteName: siteConfig.name,
        status: settings.registrationStatus,
        phoneField: siteConfig.registration.phoneField,
        allowMultipleEvents: siteConfig.registration.allowMultipleEvents,
        demo: isDemoMode,
        paymentMode: payment.mode,
        paymentUnavailableReason: payment.reason,
        testFees:
          payment.mode === "mock" && env.DEV_FEE_OVERRIDE_INR !== undefined,
        emailConfigured: isEmailConfigured,
        contact: siteConfig.contact,
        refundPolicy: siteConfig.payment.refundPolicy,
      }}
      defaultEventSlug={
        requestedSlug && getEventBySlug(requestedSlug)
          ? requestedSlug
          : undefined
      }
    />
  );
}

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const settings = await getSiteSettings();
  const status = registrationStatusCopy[settings.registrationStatus];
  const payments = paymentLabel[payment.mode];

  return (
    <>
      <PageHeader
        eyebrow="Registration"
        title="Register for DevShowdown"
        description={status.description}
      >
        <Badge tone={statusTone[settings.registrationStatus]} dot>
          {status.label}
        </Badge>
      </PageHeader>

      <div className="container-page grid gap-12 py-14 sm:py-20 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="display text-3xl text-fg">How it goes</h2>
          <ol className="mt-5 space-y-3 text-sm text-muted">
            {steps.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-xs leading-5 text-lime"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item}
              </li>
            ))}
          </ol>

          {/* The site says plainly what is and is not wired up. */}
          <h2 className="mt-9 eyebrow text-subtle">System status</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Registration</dt>
              <dd>
                <Badge tone={statusTone[settings.registrationStatus]} dot>
                  {status.label}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Storage</dt>
              <dd>
                <Badge tone={isDemoMode ? "warn" : "success"} dot>
                  {isDemoMode ? "Demo: nothing is saved" : "Database connected"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted">Payments</dt>
              <dd>
                <Badge tone={payments.tone} dot>
                  {payments.text}
                </Badge>
              </dd>
            </div>
          </dl>

          <p className="mt-6 flex gap-3 text-sm leading-relaxed text-muted">
            <Check
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-lime"
            />
            Your contact details are used only to run the event and are never
            shown on the public leaderboard.
          </p>
        </aside>

        <div className="relative min-w-0 border border-line bg-surface p-6 sm:p-9">
          <Suspense fallback={<RegistrationFlowSkeleton />}>
            <FlowWithPreselection searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
