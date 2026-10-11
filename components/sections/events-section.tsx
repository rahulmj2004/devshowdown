import { ArrowRight } from "lucide-react";
import { EventGrid } from "@/components/events/event-grid";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import type { EventConfig } from "@/types";

export function EventsSection({ events }: { events: readonly EventConfig[] }) {
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
          description="Three sub-events in the morning, then the Treasure Hunt and the Coding round. Your team registers once for all of it."
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
        <EventGrid events={events} />
      </div>
    </section>
  );
}
