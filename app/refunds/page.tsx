import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProsePage } from "@/components/layout/prose-page";
import { Notice } from "@/components/ui/notice";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "Refunds and cancellations for DevShowdown registration fees.",
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  const { contact, payment } = siteConfig;

  return (
    <>
      <PageHeader
        eyebrow="Refunds"
        title="Refund policy"
        description="How registration fees, cancellations and payment problems are handled."
      />
      <ProsePage>
        {payment.refundPolicy ? (
          <section>
            <h2>Policy</h2>
            <p>{payment.refundPolicy}</p>
          </section>
        ) : (
          <Notice tone="warn" title="Not published yet">
            The organizers have not published a refund or cancellation policy.
            It will appear here before any registration fee is charged.
          </Notice>
        )}

        <section>
          <h2>If a payment went wrong</h2>
          <ul>
            <li>
              You are only registered once this site shows a confirmation
              screen. A payment that fails or is abandoned does not register
              you.
            </li>
            <li>
              If money left your account but you did not get a confirmation, do
              not pay again. Contact the organizers with your registration
              reference so the payment can be traced.
            </li>
            <li>
              Card and UPI details are handled entirely by the payment gateway.
              This site never sees or stores them.
            </li>
          </ul>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            {contact.email ? (
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            ) : (
              "A contact address for payment questions has not been published yet."
            )}
          </p>
        </section>
      </ProsePage>
    </>
  );
}
