import type { Metadata } from "next";
import { EventGrid } from "@/components/events/event-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getEvents } from "@/config/events";
import { registrationStatusCopy } from "@/config/site";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Explore the DevShowdown competitions: Debugging, Blind Coding, Treasure Hunt, Speed Typing, and Coding.",
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  const settings = await getSiteSettings();
  const events = getEvents();
  const status = registrationStatusCopy[settings.registrationStatus];

  return (
    <>
      <PageHeader
        eyebrow="Events"
        title="Five arenas"
        description="Each event tests a different skill. Open one to see its overview, rules, format and scoring as they are confirmed."
      >
        <Badge
          tone={settings.registrationStatus === "open" ? "success" : "neutral"}
          dot
        >
          {status.label}
        </Badge>
      </PageHeader>
      <div className="container-page py-14 sm:py-20">
        <h2 className="sr-only">All events</h2>
        <EventGrid
          events={events}
          registrationStatus={settings.registrationStatus}
        />
      </div>
    </>
  );
}
