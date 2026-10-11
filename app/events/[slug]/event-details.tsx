import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  ListChecks,
  ScrollText,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { EventIcon } from "@/components/events/event-icon";
import { EventStatusBadge } from "@/components/events/event-status";
import { EventVisual } from "@/components/events/event-visual";
import { Tba } from "@/components/ui/badge";
import { getEventBySlug, getEvents } from "@/config/events";
import { siteConfig } from "@/config/site";
import { accentStyle } from "@/components/events/accent";
import { cn, formatRupees } from "@/lib/utils";

function DetailSection({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line py-9 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-3 display text-3xl text-fg">
        <Icon aria-hidden="true" className="size-5 text-(--accent)" />
        {title}
      </h2>
      <div className="mt-4 text-base leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

/** A list of confirmed items, or an explicit "not published yet" block. */
function ListOrPending({
  items,
  pending,
}: {
  items: string[] | null;
  pending: string;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-5">
        <Tba />
        <p className="mt-2.5 text-sm">{pending}</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-2.5 size-1.5 shrink-0 bg-(--accent)"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export async function EventDetails({
  params,
}: Pick<PageProps<"/events/[slug]">, "params">) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

  const otherEvents = getEvents().filter((other) => other.slug !== event.slug);

  const glance = [
    { label: "Duration", value: event.duration },
    { label: "Participation format", value: event.format },
    { label: "Team size", value: event.teamSize },
    { label: "Eligibility", value: event.eligibility },
  ];
  const { teamFee } = siteConfig.registration;
  const eventNumber = getEvents().findIndex((item) => item.slug === event.slug);

  return (
    <article style={accentStyle(event.accent)}>
      <header className="group relative isolate overflow-hidden border-b border-line">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid" />
          <div className="absolute inset-0 bg-[radial-gradient(44rem_22rem_at_25%_0%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_70%)]" />
        </div>

        <div className="container-page py-10 sm:py-14">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 rounded text-sm text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            All events
          </Link>

          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="flex items-center gap-2 eyebrow text-(--accent)">
                <EventIcon icon={event.icon} className="size-4" />
                {event.category}
                <span aria-hidden="true" className="text-subtle">
                  · arena {String(eventNumber + 1).padStart(2, "0")}
                </span>
              </p>
              <h1
                data-text={event.title}
                className={cn(
                  "mt-4 display text-6xl text-fg sm:text-8xl",
                  event.visual === "debug" && "glitch",
                )}
              >
                {event.title}
              </h1>
              <p className="mt-4 font-mono text-sm tracking-[0.14em] text-(--accent) uppercase">
                {event.tagline}
              </p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                {event.summary}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <EventStatusBadge status={event.status} />
              </div>
            </div>

            <div className="relative h-64 overflow-hidden border border-line sm:h-80">
              <EventVisual kind={event.visual} accent={event.accent} />
            </div>
          </div>
        </div>
      </header>

      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div>
          <DetailSection title="Overview" Icon={ScrollText}>
            <div className="space-y-4">
              {event.overview.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </DetailSection>

          <DetailSection title="Rules" Icon={ListChecks}>
            <ListOrPending
              items={event.rules}
              pending="The rules for this event have not been published yet."
            />
          </DetailSection>

          <DetailSection title="Scoring system" Icon={Gauge}>
            <ListOrPending
              items={event.scoring}
              pending="How this event is scored has not been published yet."
            />
          </DetailSection>

          <DetailSection title="Required tools" Icon={Wrench}>
            <ListOrPending
              items={event.tools}
              pending="What you need to bring or install has not been published yet."
            />
          </DetailSection>
        </div>

        <aside aria-label="Event summary" className="lg:pt-1">
          <div className="sticky top-24 card p-6">
            <h2 className="eyebrow text-subtle">At a glance</h2>
            <dl className="mt-4 divide-y divide-line">
              <div className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-muted">Status</dt>
                <dd>
                  <EventStatusBadge status={event.status} />
                </dd>
              </div>
              {glance.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-4 py-3 text-sm"
                >
                  <dt className="text-muted">{item.label}</dt>
                  <dd className="text-right text-fg">
                    {item.value ?? <Tba label="TBA" />}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-muted">Entry fee</dt>
                <dd className="text-right text-fg">
                  {event.fee === null ? (
                    teamFee === null ? (
                      <Tba label="TBA" />
                    ) : (
                      // One fee per team covers every competition.
                      `${formatRupees(teamFee)} per team, all events`
                    )
                  ) : event.fee === 0 ? (
                    "Free"
                  ) : (
                    formatRupees(event.fee)
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {otherEvents.length > 0 && (
        <nav
          aria-labelledby="other-events"
          className="border-t border-line bg-bg-soft"
        >
          <div className="container-page py-14">
            <h2 id="other-events" className="eyebrow text-subtle">
              More competitions
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {otherEvents.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`/events/${other.slug}`}
                    className="group flex h-full items-center gap-3 card p-5 transition-colors hover:border-line-strong"
                  >
                    <EventIcon
                      icon={other.icon}
                      className="size-5 shrink-0 text-lime"
                    />
                    <span className="flex-1 display text-xl text-fg">
                      {other.title}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 text-subtle transition-transform duration-300 group-hover:translate-x-1 group-hover:text-fg"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </article>
  );
}

export function EventDetailsSkeleton() {
  return (
    <div role="status" className="container-page py-14">
      <span className="sr-only">Loading event…</span>
      <div className="h-4 w-24 animate-pulse rounded bg-white/[0.07]" />
      <div className="mt-10 h-12 w-2/3 max-w-md animate-pulse rounded-lg bg-white/[0.07]" />
      <div className="mt-5 h-5 w-full max-w-xl animate-pulse rounded bg-white/[0.07]" />
      <div className="mt-12 h-64 animate-pulse rounded-2xl bg-white/[0.05]" />
    </div>
  );
}
