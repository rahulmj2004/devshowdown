import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProsePage } from "@/components/layout/prose-page";
import { Notice } from "@/components/ui/notice";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How DevShowdown handles registration data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const { contact, registration } = siteConfig;

  return (
    <>
      <PageHeader
        eyebrow="Privacy"
        title="Privacy notice"
        description="What this site collects when you register, and what it is used for."
      />
      <ProsePage>
        <Notice tone="warn" title="Draft pending organizer review">
          This notice describes how the site works today. The organizers still
          need to confirm the data controller, retention period and contact
          point before registration opens.
        </Notice>

        <section>
          <h2>What we collect</h2>
          <p>When you register, the form asks for:</p>
          <ul>
            <li>Your full name</li>
            <li>Your email address</li>
            <li>Your college or organization</li>
            <li>
              The competitions you are entering, a team name if you give one,
              and the names of your team members for team events
            </li>
            {registration.phoneField !== "hidden" && (
              <li>
                Your phone number
                {registration.phoneField === "optional" ? " (optional)" : ""}
              </li>
            )}
          </ul>
        </section>

        <section>
          <h2>Payments</h2>
          <p>
            If a registration fee applies, it is paid in the payment
            gateway&apos;s own secure window. This site never sees or stores
            card numbers, CVVs, UPI PINs or bank credentials. It keeps only the
            gateway&apos;s order and payment reference, the amount and the
            payment status, so that your registration can be confirmed.
          </p>
          <p>
            Your browser stores a random key and your registration reference so
            that refreshing the page does not start a second registration. No
            personal details are kept in the browser.
          </p>
        </section>

        <section>
          <h2>How it is used</h2>
          <p>
            Registration details are used to administer your participation in
            the event. They are visible only to the organizers.
          </p>
          <p>
            The public leaderboard shows a display name, score and completion
            time. It never shows email addresses or phone numbers.
          </p>
        </section>

        <section>
          <h2>Retention and your choices</h2>
          <p>
            How long registration data is kept, and how to ask for it to be
            corrected or deleted, is awaiting confirmation from the organizers.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            {contact.email ? (
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            ) : (
              "A contact address for privacy questions has not been published yet."
            )}
          </p>
        </section>
      </ProsePage>
    </>
  );
}
