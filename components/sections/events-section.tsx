import { ArrowRight } from "lucide-react";
import { EventGrid } from "@/components/events/event-grid";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import type { EventConfig, RegistrationStatus } from "@/types";

export function EventsSection({
  events,
  registrationStatus,
}: {
  events: readonly EventConfig[];
  registrationStatus: RegistrationStatus;
}) {
  return (
    <section
      id="events"
      aria-labelledby="events-heading"
      className="container-page py-24 sm:py-32"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          id="events-heading"
          index="01"
          eyebrow="The competitions"
          title="Choose your arena"
          description="Five arenas, five different ways to win. Each one tests a different edge, so pick the one that plays to your strengths."
        />
        <Reveal>
          <ButtonLink
            href="/events"
            variant="secondary"
            className="group shrink-0"
          >
            All events
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            />
          </ButtonLink>
        </Reveal>
      </div>

      <div className="mt-14">
        <EventGrid events={events} registrationStatus={registrationStatus} />
      </div>
    </section>
  );
}
