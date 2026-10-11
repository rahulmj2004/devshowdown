import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import type { EventConfig } from "@/types";
import { EventCard } from "./event-card";

/**
 * Column spans for a 12-column grid, repeating every five events: two uneven
 * pairs, then a full-width arena. Keeps the section from reading as a row of
 * identical cards however many events are configured.
 */
const spans = [
  "lg:col-span-7",
  "lg:col-span-5",
  "lg:col-span-5",
  "lg:col-span-7",
  "lg:col-span-12",
];

export function EventGrid({ events }: { events: readonly EventConfig[] }) {
  return (
    <ul className="grid gap-5 lg:grid-cols-12 lg:gap-6">
      {events.map((event, index) => {
        const slot = index % spans.length;
        return (
          <li key={event.slug} className={cn("min-w-0", spans[slot])}>
            <Reveal delay={(index % 2) * 0.1} className="h-full">
              <EventCard
                event={event}
                index={index}
                total={events.length}
                wide={slot === 4}
              />
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
