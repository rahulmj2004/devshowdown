import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ProsePage } from "@/components/layout/prose-page";
import { Notice } from "@/components/ui/notice";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of participation for DevShowdown.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  const { contact, details } = siteConfig;

  return (
    <>
      <PageHeader
        eyebrow="Terms"
        title="Terms of participation"
        description="What registering for DevShowdown means, as far as it has been decided."
      />
      <ProsePage>
        <Notice tone="warn" title="Draft pending organizer review">
          These terms describe how the site works today. The organizers have not
          yet published the final terms, so nothing here is a binding commitment
          about dates, prizes or eligibility.
        </Notice>

        <section>
          <h2>Registering</h2>
          <p>
            A registration is confirmed only when this site shows a confirmation
            screen with a registration reference. If a fee applies, that happens
            after the payment has been verified.
          </p>
          <p>
            Give accurate details. One entry per person per competition is
            accepted.
          </p>
        </section>

        <section>
          <h2>Rules and conduct</h2>
          <p>
            Participants agree to follow the{" "}
            <Link href="/rules">event rules</Link> and each competition&apos;s
            own rules, which are published on its event page once confirmed.
          </p>
        </section>

        <section>
          <h2>Prizes</h2>
          <p>
            Prize amounts, their distribution and who is eligible are announced
            by the organizers. Until they are confirmed on this site, they are
            shown as approximate or to be announced.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            Dates, venue, schedule and competition details can change until the
            organizers confirm them. Anything unconfirmed is labelled as such.
          </p>
        </section>

        <section>
          <h2>Organizer and contact</h2>
          <p>
            {details.organizer
              ? `Organized by the ${details.organizer}.`
              : "The organizing body has not been published yet."}{" "}
            {contact.email ? (
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            ) : (
              "A contact address has not been published yet."
            )}
          </p>
        </section>
      </ProsePage>
    </>
  );
}
