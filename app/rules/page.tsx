import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ProsePage } from "@/components/layout/prose-page";
import { Notice } from "@/components/ui/notice";
import { getEvents } from "@/config/events";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Event rules",
  description: "General and per-event rules for DevShowdown.",
  alternates: { canonical: "/rules" },
};

export default function RulesPage() {
  const events = getEvents();

  return (
    <>
      <PageHeader
        eyebrow="Rules"
        title="Event rules"
        description="The rules you agree to when you register."
      />
      <ProsePage>
        {siteConfig.rules ? (
          <section>
            <h2>Rules and regulations</h2>
            <ol>
              {siteConfig.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </section>
        ) : (
          <Notice tone="warn" title="Awaiting confirmation">
            The general rules and code of conduct have not been published yet.
            They will appear here before registration opens.
          </Notice>
        )}

        <section>
          <h2>Rules for each competition</h2>
          <p>
            Every competition has its own rules, format and scoring. Each event
            page shows them as soon as they are confirmed:
          </p>
          <ul>
            {events.map((event) => (
              <li key={event.slug}>
                <Link href={`/events/${event.slug}`}>{event.title}</Link>
                {event.rules ? "" : " (rules awaiting confirmation)"}
              </li>
            ))}
          </ul>
        </section>
      </ProsePage>
    </>
  );
}
