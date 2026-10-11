import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Tilt } from "@/components/motion/tilt";
import { buttonClasses } from "@/components/ui/button";
import {
  getRegistrationLabel,
  isEventRegistrationOpen,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";
import type { EventConfig, RegistrationStatus } from "@/types";
import { accentStyle } from "./accent";
import { EventIcon } from "./event-icon";
import { EventMeta } from "./event-meta";
import { EventStatusBadge } from "./event-status";
import { EventVisual } from "./event-visual";

/**
 * One competition, presented as its own arena: a distinct illustration and
 * accent colour inside a shared frame. `wide` lays it out side by side on
 * large screens.
 */
export function EventCard({
  event,
  registrationStatus,
  index,
  total,
  wide = false,
}: {
  event: EventConfig;
  registrationStatus: RegistrationStatus;
  /** Zero-based position, shown as "01 / 05". */
  index?: number;
  total?: number;
  wide?: boolean;
}) {
  const registrationOpen = isEventRegistrationOpen(event, registrationStatus);

  return (
    <Tilt className="h-full">
      <article
        style={accentStyle(event.accent)}
        className={cn(
          "group relative flex h-full flex-col overflow-hidden border border-line bg-surface",
          "transition-[border-color,box-shadow] duration-500 ease-out",
          "hover:border-(--accent)/60 hover:shadow-[0_30px_80px_-40px_var(--accent)]",
          "focus-within:border-(--accent)/60",
          wide && "lg:grid lg:grid-cols-[1.15fr_1fr]",
        )}
      >
        <div
          className={cn(
            "relative h-60 border-b border-line sm:h-72",
            wide && "lg:h-auto lg:min-h-80 lg:border-r lg:border-b-0",
          )}
        >
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.025]">
            <EventVisual kind={event.visual} accent={event.accent} />
          </div>
          {/* Corner brackets: a technical frame around every arena. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-2.5 size-3 border-t border-l border-(--accent)/70"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 bottom-2.5 size-3 border-r border-b border-(--accent)/70"
          />
        </div>

        <div className="relative flex flex-1 flex-col p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 eyebrow text-(--accent)">
              <EventIcon icon={event.icon} className="size-4" />
              {event.category}
            </p>
            <div className="flex items-center gap-3">
              <EventStatusBadge status={event.status} />
              {index !== undefined && total !== undefined && (
                <span
                  aria-hidden="true"
                  className="font-mono text-[11px] text-subtle"
                >
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(total).padStart(2, "0")}
                </span>
              )}
            </div>
          </div>

          <h3
            data-text={event.title}
            className={cn(
              "mt-5 display text-5xl text-fg sm:text-6xl",
              event.visual === "debug" && "glitch",
            )}
          >
            {event.title}
          </h3>
          <p className="mt-3 font-mono text-xs tracking-[0.14em] text-(--accent) uppercase">
            {event.tagline}
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {event.summary}
          </p>

          <div className="mt-6">
            <EventMeta event={event} />
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
            {/* The stretched pseudo-element makes the whole card a link target. */}
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center gap-1.5 rounded-sm eyebrow text-fg transition-colors group-hover:text-(--accent) after:absolute after:inset-0"
            >
              Learn more <span className="sr-only">about {event.title}</span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>

            {registrationOpen ? (
              <Link
                href={`/register?event=${event.slug}`}
                className={buttonClasses({
                  size: "sm",
                  className: "group/register z-10",
                })}
              >
                Register <span className="sr-only">for {event.title}</span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform duration-300 group-hover/register:translate-x-0.5"
                />
              </Link>
            ) : (
              <span className="font-mono text-[11px] text-subtle">
                {getRegistrationLabel(event, registrationStatus)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Tilt>
  );
}
