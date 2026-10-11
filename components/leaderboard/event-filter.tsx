import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EventConfig } from "@/types";

/**
 * Event filter rendered as plain links, so it works without JavaScript and
 * every filtered view has a shareable URL.
 */
export function EventFilter({
  events,
  activeSlug,
  demo,
}: {
  events: readonly EventConfig[];
  activeSlug?: string;
  demo: boolean;
}) {
  const hrefFor = (slug?: string) => {
    const params = new URLSearchParams();
    if (slug) params.set("event", slug);
    if (demo) params.set("demo", "1");
    const query = params.toString();
    return query ? `/leaderboard?${query}` : "/leaderboard";
  };

  const options = [
    { label: "All events", slug: undefined as string | undefined },
    ...events.map((event) => ({ label: event.title, slug: event.slug })),
  ];

  return (
    <nav aria-label="Filter leaderboard by event">
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.slug === activeSlug;
          return (
            <li key={option.slug ?? "all"}>
              <Link
                href={hrefFor(option.slug)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
                  active
                    ? "border-violet-bright/50 bg-violet/20 text-fg"
                    : "border-line-strong text-muted hover:border-violet-bright/40 hover:text-fg",
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
