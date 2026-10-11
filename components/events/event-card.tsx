import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Tilt } from "@/components/motion/tilt";
import { cn } from "@/lib/utils";
import type { EventConfig } from "@/types";
import { accentStyle } from "./accent";
import { EventIcon } from "./event-icon";
import { EventMeta } from "./event-meta";
import { EventStatusBadge } from "./event-status";
import { EventVisual } from "./event-visual";

/**
 * One competition, presented as its own arena: a distinct illustration and
 * accent colour inside a shared frame. `wide` lays it out side by side on
 * large screens. Teams register once for the whole event, so a card never
 * carries its own register button.
 */
export function EventCard({
  event,
  index,
  total,
  wide = false,
}: {
  event: EventConfig;
  /** Zero-based position, shown as "01 / 05". */
  index?: number;
  total?: number;
  wide?: boolean;
}) {
  const number =
    index === undefined ? null : String(index + 1).padStart(2, "0");

  return (
    <Tilt className="h-full">
      <article
        style={accentStyle(event.accent)}
        className={cn(
          "group relative flex h-full flex-col overflow-hidden border border-line bg-surface",
          "transition-[border-color,box-shadow] duration-500 ease-out",
          "hover:border-(--accent)/60 hover:shadow-[0_30px_80px_-40px_var(--accent)]",
          "focus-within:border-(--accent)/60",
          wide && "lg:grid lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[auto_1fr]",
        )}
      >
        {/* Accent hairline that lights up with the card. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-(--accent) to-transparent opacity-50 transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-100"
        />

        {/* Title bar: where this round sits in the day, and its state. */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b border-line bg-bg/60 px-5 py-3 sm:px-6",
            wide && "lg:col-span-2",
          )}
        >
          <p className="flex min-w-0 items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            {number && total !== undefined && (
              <span aria-hidden="true" className="shrink-0 text-subtle">
                <span className="text-(--accent)">{number}</span> /{" "}
                {String(total).padStart(2, "0")}
              </span>
            )}
            <span className="flex min-w-0 items-center gap-2 text-(--accent)">
              <EventIcon icon={event.icon} className="size-3.5 shrink-0" />
              <span className="truncate">{event.category}</span>
            </span>
          </p>
          <EventStatusBadge status={event.status} />
        </div>

        <div
          className={cn(
            "relative h-60 border-b border-line sm:h-72",
            wide && "lg:h-auto lg:min-h-88 lg:border-r lg:border-b-0",
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

        <div className="relative flex flex-1 flex-col overflow-hidden p-6 sm:p-8">
          {/* Oversized hollow round number behind the copy. */}
          {number && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-4 hidden display text-[7rem] leading-none text-outline opacity-60 transition-opacity duration-500 select-none [--outline-color:color-mix(in_oklab,var(--accent)_30%,transparent)] group-hover:opacity-100 sm:block"
            >
              {number}
            </span>
          )}

          <h3
            data-text={event.title}
            className={cn(
              "relative display text-5xl text-fg sm:text-6xl",
              event.visual === "debug" && "glitch",
            )}
          >
            {event.title}
          </h3>
          <p className="relative mt-3 flex items-center gap-3 font-mono text-xs tracking-[0.14em] text-(--accent) uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-(--accent)/70" />
            {event.tagline}
          </p>
          <p className="relative mt-4 max-w-md text-sm leading-relaxed text-muted">
            {event.summary}
          </p>

          <div className="relative mt-7">
            <EventMeta event={event} />
          </div>

          <div className="mt-auto pt-7">
            {/* The stretched pseudo-element makes the whole card a link target. */}
            <Link
              href={`/events/${event.slug}`}
              className="flex items-center justify-between gap-4 rounded-sm eyebrow text-fg transition-colors group-hover:text-(--accent) after:absolute after:inset-0"
            >
              <span>
                Learn more <span className="sr-only">about {event.title}</span>
              </span>
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center border border-line-strong text-fg transition-colors duration-300 group-hover:border-(--accent) group-hover:bg-(--accent) group-hover:text-[#060608]"
              >
                <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          </div>
        </div>
      </article>
    </Tilt>
  );
}
