"use client";

import { Check, Copy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import type { RegistrationSummary } from "@/lib/registration/service";
import { formatPaise, telHref } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Ring and tick draw themselves, with a short burst behind them. */
function SuccessMark() {
  const reduceMotion = useReducedMotion();
  const rays = Array.from({ length: 8 }, (_, index) => index * 45);

  return (
    <div aria-hidden="true" className="relative size-20">
      {!reduceMotion &&
        rays.map((angle) => (
          <motion.span
            key={angle}
            className="absolute top-1/2 left-1/2 -mt-px -ml-2 h-0.5 w-4 origin-left bg-lime"
            style={{ rotate: angle }}
            initial={{ x: 26, opacity: 0, scaleX: 0.3 }}
            animate={{
              x: [26, 46, 54],
              opacity: [0, 1, 0],
              scaleX: [0.3, 1, 0.4],
            }}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          />
        ))}
      <svg viewBox="0 0 80 80" fill="none" className="size-full">
        <circle cx="40" cy="40" r="37" stroke="#c8ff2e33" strokeWidth="2" />
        <circle
          cx="40"
          cy="40"
          r="37"
          pathLength="1"
          stroke="#c8ff2e"
          strokeWidth="2"
          strokeLinecap="round"
          className="draw origin-center -rotate-90"
        />
        <path
          d="M25 41.5 35.5 52 56 30"
          pathLength="1"
          stroke="#c8ff2e"
          strokeWidth="4"
          strokeLinecap="square"
          className="draw"
          style={{ "--d": "0.45s" } as CSSProperties}
        />
      </svg>
    </div>
  );
}

/**
 * Final step. Rendered only from a registration the server reports as
 * confirmed; it shows that server state, not anything the browser decided.
 */
export function Confirmation({
  registration,
  emailConfigured,
  contact,
  onRegisterAnother,
}: {
  registration: RegistrationSummary;
  emailConfigured: boolean;
  contact: { email: string | null; phone: string | null };
  onRegisterAnother: () => void;
}) {
  const toast = useToast();
  const paid = registration.paymentStatus === "paid";

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(registration.reference);
      toast({ title: "Reference copied", tone: "success" });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select the reference and copy it manually.",
        tone: "danger",
      });
    }
  };

  return (
    <div role="status">
      {registration.demo && (
        <Notice
          tone="warn"
          title="Demo mode: this is not a real registration"
          className="mb-6"
        >
          No database is connected to this site, so nothing was saved and this
          reference will not be recognised at the event.
        </Notice>
      )}
      {registration.testPayment && (
        <Notice
          tone="warn"
          title="Simulated payment: no money was charged"
          className="mb-6"
        >
          This registration was settled through the development mock gateway. It
          is a test entry, not a paid one.
        </Notice>
      )}

      <div className="flex flex-col items-center text-center">
        <SuccessMark />
        <h2
          tabIndex={-1}
          data-step-heading=""
          className="mt-6 display text-4xl text-fg outline-none sm:text-5xl"
        >
          {registration.demo ? "Demo run complete" : "You're in the arena"}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          {registration.demo
            ? "This is how a confirmed registration looks. Nothing here is saved."
            : `${registration.fullName}, your registration is confirmed.`}
        </p>
      </div>

      <div className="mt-8 border border-line-strong bg-bg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="eyebrow text-subtle">Registration reference</p>
            <p className="mt-1 font-mono text-xl tracking-wider text-lime select-all">
              {registration.reference}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={copyReference}>
            <Copy aria-hidden="true" className="size-3.5" />
            Copy
          </Button>
        </div>

        <dl className="divide-y divide-line text-sm">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted">Status</dt>
            {registration.demo ? (
              <dd className="font-medium text-warn">
                Demo only, not registered
              </dd>
            ) : (
              <dd className="flex items-center gap-1.5 font-medium text-lime">
                <Check aria-hidden="true" className="size-4" />
                Confirmed
              </dd>
            )}
          </div>
          <div className="px-5 py-3.5">
            <dt className="text-muted">Competitions</dt>
            <dd className="mt-2">
              <ul className="space-y-1.5">
                {registration.entries.map((entry) => (
                  <li key={entry.eventSlug} className="text-fg">
                    {entry.eventTitle}
                    {entry.teamName && (
                      <span className="text-muted">
                        {" "}
                        · team {entry.teamName}
                        {entry.members.length > 0 &&
                          ` (with ${entry.members.join(", ")})`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted">Payment</dt>
            <dd className="text-right text-fg">
              {paid ? (
                <>
                  {formatPaise(registration.amountPaise)} ·{" "}
                  {registration.testPayment
                    ? "simulated, not charged"
                    : "verified"}
                </>
              ) : (
                "No payment required"
              )}
            </dd>
          </div>
          {paid && registration.paymentReference && (
            <div className="flex items-start justify-between gap-4 px-5 py-3.5">
              <dt className="text-muted">Payment reference</dt>
              <dd className="text-right font-mono text-xs break-all text-fg select-all">
                {registration.paymentReference}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <h3 className="eyebrow text-subtle">Next steps</h3>
          <ul className="mt-3 space-y-2 leading-relaxed text-muted">
            <li>Save your registration reference.</li>
            <li>
              {registration.demo
                ? "No confirmation email is sent in demo mode."
                : emailConfigured
                  ? `A confirmation email is on its way to ${registration.email}. If it does not arrive, your reference is all you need.`
                  : "This site does not send confirmation emails yet, so your reference is your proof of registration."}
            </li>
            <li>Check this site for schedule and venue announcements.</li>
          </ul>
        </div>
        <div>
          <h3 className="eyebrow text-subtle">Event contact</h3>
          <ul className="mt-3 space-y-2 text-muted">
            {contact.email || contact.phone ? (
              <>
                {contact.email && (
                  <li>
                    <a
                      href={`mailto:${contact.email}`}
                      className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
                    >
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li>
                    <a
                      href={telHref(contact.phone)}
                      className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
                    >
                      {contact.phone}
                    </a>
                  </li>
                )}
              </>
            ) : (
              <li>Organizer contact details have not been published yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/events">Back to events</ButtonLink>
        <Button variant="secondary" onClick={onRegisterAnother}>
          Register someone else
        </Button>
      </div>
    </div>
  );
}
