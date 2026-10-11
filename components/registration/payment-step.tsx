"use client";

import { LoaderCircle, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  beginPayment,
  fetchRegistration,
  resolveMockPayment,
  verifyPayment,
} from "@/app/register/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import type {
  CheckoutSession,
  PaymentResponse,
  RegistrationSummary,
} from "@/lib/registration/service";
import { formatPaise } from "@/lib/utils";
import { openRazorpayCheckout } from "./razorpay-checkout";

type Phase = "idle" | "starting" | "checkout" | "verifying";

/** What happened on the last attempt, for the notice above the button. */
type Note =
  | { kind: "dismissed" }
  | { kind: "attempt_failed" }
  | { kind: "rejected" }
  | { kind: "unavailable"; reason: string }
  | { kind: "not_found" }
  | { kind: "error" };

const POLL_INTERVAL_MS = 6000;
const MAX_POLLS = 20;

/**
 * Step 4. Shows the payment state the server holds and drives checkout.
 *
 * Nothing here marks a registration as paid. Checkout only ever produces a
 * claim, which is sent to the server to be verified; the screen then shows
 * whatever state the server returns. Retrying reuses the same order, so a
 * second click, a refresh or a failed attempt cannot create a second charge.
 */
export function PaymentStep({
  registration,
  access,
  siteName,
  onUpdate,
  onStartOver,
}: {
  registration: RegistrationSummary;
  access: { reference: string; clientKey: string };
  siteName: string;
  onUpdate: (registration: RegistrationSummary) => void;
  onStartOver: () => void;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<Note | null>(null);
  const [mockSession, setMockSession] = useState<Extract<
    CheckoutSession,
    { mode: "mock" }
  > | null>(null);
  const inFlight = useRef(false);

  const busy = phase !== "idle";
  const amount = formatPaise(registration.amountPaise);
  const awaitingVerification =
    registration.paymentStatus === "verification_required";
  const superseded = registration.status === "superseded";
  const payable =
    registration.status === "pending_payment" &&
    (registration.paymentStatus === "pending" ||
      registration.paymentStatus === "failed");

  // While a payment is being verified, keep asking the server. The webhook
  // can settle it at any moment, and the participant should not have to act.
  useEffect(() => {
    if (!awaitingVerification) return;
    let polls = 0;
    const timer = window.setInterval(async () => {
      polls += 1;
      if (polls >= MAX_POLLS) window.clearInterval(timer);
      const latest = await fetchRegistration(access).catch(() => null);
      if (latest && latest.paymentStatus !== "verification_required") {
        onUpdate(latest);
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [awaitingVerification, access, onUpdate]);

  const refresh = async () => {
    const latest = await fetchRegistration(access).catch(() => null);
    if (latest) onUpdate(latest);
    return latest;
  };

  const applyResponse = (response: PaymentResponse) => {
    if (response.status === "settled") {
      const state = response.registration.paymentStatus;
      if (state === "paid") {
        toast({
          title: response.registration.testPayment
            ? "Simulated payment accepted"
            : "Payment verified",
          description: response.registration.testPayment
            ? "No money was charged."
            : undefined,
          tone: "success",
        });
      } else if (state === "failed") {
        toast({
          title: "Payment did not go through",
          description: "You can try again whenever you are ready.",
          tone: "danger",
        });
      } else if (state === "verification_required") {
        toast({
          title: "Payment received, verification in progress",
          description: "Please do not pay again.",
        });
      }
      onUpdate(response.registration);
      return;
    }
    if (response.status === "rejected") setNote({ kind: "rejected" });
    else if (response.status === "not_found") setNote({ kind: "not_found" });
    else setNote({ kind: "error" });
  };

  /** Runs one guarded action: a second click while it runs does nothing. */
  const guarded = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await action();
    } catch {
      setNote({ kind: "error" });
    } finally {
      inFlight.current = false;
      setPhase("idle");
    }
  };

  const pay = () =>
    guarded(async () => {
      setNote(null);
      setPhase("starting");
      const started = await beginPayment(access);

      if (started.status === "settled") return onUpdate(started.registration);
      if (started.status === "payments_unavailable") {
        return setNote({ kind: "unavailable", reason: started.reason });
      }
      if (started.status === "not_found") return setNote({ kind: "not_found" });
      if (started.status !== "ready") return setNote({ kind: "error" });

      if (started.checkout.mode === "mock") {
        setMockSession(started.checkout);
        return;
      }

      setPhase("checkout");
      const outcome = await openRazorpayCheckout(started.checkout, {
        siteName,
        reference: registration.reference,
      });
      if (outcome.kind === "dismissed") {
        setNote({
          kind: outcome.attemptFailed ? "attempt_failed" : "dismissed",
        });
        toast({
          title: "Checkout closed",
          description: "Your registration is saved. You can pay when ready.",
        });
        // A webhook may already have recorded what happened in that window.
        await refresh();
        return;
      }

      setPhase("verifying");
      applyResponse(await verifyPayment(access, outcome.response));
    });

  const resolveMock = (result: "success" | "failure") =>
    guarded(async () => {
      setNote(null);
      setPhase("verifying");
      const response = await resolveMockPayment(access, result);
      setMockSession(null);
      applyResponse(response);
    });

  const closeMock = () => {
    setMockSession(null);
    setNote({ kind: "dismissed" });
    toast({
      title: "Checkout closed",
      description: "Your registration is saved. You can pay when ready.",
    });
  };

  return (
    <div>
      <h2
        tabIndex={-1}
        data-step-heading=""
        className="display text-3xl text-fg outline-none sm:text-4xl"
      >
        Payment
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Your details are saved. Your place is confirmed once the payment has
        been verified.
      </p>

      {registration.demo && (
        <Notice
          tone="warn"
          title="Demo mode: this is not a real registration"
          className="mt-6"
        >
          No database is connected, so nothing is saved and no real payment can
          be taken.
        </Notice>
      )}

      <dl className="mt-6 divide-y divide-line border border-line-strong bg-bg text-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <dt className="text-muted">Registration reference</dt>
          <dd className="font-mono tracking-wider text-fg select-all">
            {registration.reference}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <dt className="text-muted">Payment status</dt>
          <dd>
            {awaitingVerification ? (
              <Badge tone="warn" dot>
                Verification required
              </Badge>
            ) : registration.paymentStatus === "failed" ? (
              <Badge tone="warn" dot>
                Failed
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                Pending
              </Badge>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <dt className="text-muted">Amount due</dt>
          <dd className="display text-3xl text-lime">{amount}</dd>
        </div>
      </dl>

      <div aria-live="polite" className="mt-5 space-y-3 empty:hidden">
        {awaitingVerification && (
          <Notice tone="warn" title="We are verifying your payment">
            The payment gateway has reported a payment that this site has not
            been able to confirm yet. Please do not pay again. This page checks
            automatically; if it is still unresolved, contact the organizers and
            quote your reference.
          </Notice>
        )}
        {superseded && !awaitingVerification && (
          <Notice tone="warn" title="This registration was replaced">
            A newer registration was started with the same email address for the
            same competition. Start again to continue.
          </Notice>
        )}
        {registration.paymentStatus === "failed" && !note && (
          <Notice tone="danger" title="The last payment attempt failed">
            Nothing was confirmed. You can try again; you will not be charged
            twice for the same registration.
          </Notice>
        )}
        {note?.kind === "dismissed" && (
          <Notice tone="info" title="Checkout was closed before paying">
            Nothing was charged. Your registration is saved as pending.
          </Notice>
        )}
        {note?.kind === "attempt_failed" && (
          <Notice tone="danger" title="That payment attempt failed">
            Nothing was confirmed. You can try again with the same or another
            payment method.
          </Notice>
        )}
        {note?.kind === "rejected" && (
          <Notice tone="danger" title="We could not verify that payment">
            You have not been marked as paid. If money left your account,
            contact the organizers and quote your reference; do not pay again.
          </Notice>
        )}
        {note?.kind === "unavailable" && (
          <Notice tone="warn" title="Online payment is not available yet">
            {note.reason} Your registration is saved as pending.
          </Notice>
        )}
        {note?.kind === "not_found" && (
          <Notice tone="warn" title="This registration could not be found">
            It may have been started in another browser, or the demo server was
            restarted. Start again to continue.
          </Notice>
        )}
        {note?.kind === "error" && (
          <Notice tone="danger" title="Something went wrong">
            Nothing was confirmed. Please try again in a moment.
          </Notice>
        )}
      </div>

      {mockSession ? (
        <div
          role="group"
          aria-labelledby="mock-checkout-title"
          className="mt-6 border-2 border-dashed border-warn/60 bg-warn/[0.05] p-5"
        >
          <p id="mock-checkout-title" className="eyebrow text-warn">
            Mock checkout · development only
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This stands in for the payment gateway. No money moves and no card
            details are requested. Choose how this simulated payment of{" "}
            <span className="text-fg">
              {formatPaise(mockSession.amountPaise)}
            </span>{" "}
            should end.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Button disabled={busy} onClick={() => resolveMock("success")}>
              {phase === "verifying" && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}
              Simulate successful payment
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => resolveMock("failure")}
            >
              Simulate failed payment
            </Button>
            <Button variant="ghost" disabled={busy} onClick={closeMock}>
              Close checkout
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {payable && (
            <Button size="lg" disabled={busy} onClick={pay} aria-busy={busy}>
              {busy ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <Lock aria-hidden="true" className="size-4" />
              )}
              {phase === "starting"
                ? "Preparing checkout…"
                : phase === "checkout"
                  ? "Waiting for checkout…"
                  : phase === "verifying"
                    ? "Verifying payment…"
                    : registration.paymentStatus === "failed"
                      ? `Try again · ${amount}`
                      : `Pay ${amount}`}
            </Button>
          )}
          {awaitingVerification && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                guarded(async () => {
                  setPhase("verifying");
                  await refresh();
                })
              }
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Check again
            </Button>
          )}
          {!awaitingVerification && (
            <Button variant="ghost" disabled={busy} onClick={onStartOver}>
              {superseded || note?.kind === "not_found"
                ? "Start again"
                : "Change my details"}
            </Button>
          )}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-subtle">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Payment details are entered in the payment gateway&apos;s own secure
        window. This site never sees or stores card numbers, CVVs or UPI PINs.
      </p>
    </div>
  );
}
