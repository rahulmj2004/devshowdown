import { EventIcon } from "@/components/events/event-icon";
import { formatCompletionTime, formatScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import type { EventConfig, RankedEntry } from "@/types";

const rankStyles: Record<number, string> = {
  1: "border-violet-bright/60 bg-violet/30 text-white",
  2: "border-cyan/40 bg-cyan/10 text-cyan",
  3: "border-line-strong bg-white/[0.06] text-fg",
};

/** Ranked results for a single event. Rows carry display names only. */
export function LeaderboardTable({
  event,
  rows,
  limit,
  headingLevel: Heading = "h2",
}: {
  event: EventConfig;
  rows: readonly RankedEntry[];
  limit?: number;
  headingLevel?: "h2" | "h3";
}) {
  const { ranking } = event;
  const visible = limit ? rows.slice(0, limit) : rows;
  const numeric = "px-4 py-3.5 text-right font-mono tabular-nums sm:px-5";

  return (
    <div className="overflow-hidden card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <Heading className="flex items-center gap-2.5 text-base font-semibold text-fg">
          <EventIcon icon={event.icon} className="size-4 text-violet-bright" />
          {event.title}
        </Heading>
        <span className="text-xs text-subtle">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{event.title} leaderboard</caption>
          <thead>
            <tr className="border-b border-line text-left eyebrow text-subtle">
              <th scope="col" className="w-16 px-4 py-3 font-normal sm:px-5">
                Rank
              </th>
              <th scope="col" className="px-2 py-3 font-normal">
                Participant / Team
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 font-normal md:table-cell"
              >
                Event
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-normal sm:px-5"
              >
                {ranking.scoreLabel}
              </th>
              {ranking.showTime && (
                <th
                  scope="col"
                  className="px-4 py-3 text-right font-normal sm:px-5"
                >
                  Time
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3.5 sm:px-5">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-lg border font-mono text-xs tabular-nums",
                      rankStyles[row.rank] ?? "border-transparent text-muted",
                    )}
                  >
                    {row.rank}
                  </span>
                </td>
                <th
                  scope="row"
                  className="px-2 py-3.5 text-left font-medium text-fg"
                >
                  {row.displayName}
                </th>
                <td className="hidden px-4 py-3.5 text-muted md:table-cell">
                  {event.title}
                </td>
                <td className={cn(numeric, "text-fg")}>
                  {formatScore(row.score)}
                </td>
                {ranking.showTime && (
                  <td className={cn(numeric, "text-muted")}>
                    {formatCompletionTime(row.completionTimeMs)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div role="status" className="overflow-hidden card">
      <span className="sr-only">Loading leaderboard…</span>
      <div className="border-b border-line px-5 py-4">
        <div className="h-5 w-40 animate-pulse rounded bg-white/[0.07]" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-5 py-4">
            <div className="size-7 animate-pulse rounded-lg bg-white/[0.07]" />
            <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-4 w-14 animate-pulse rounded bg-white/[0.07]" />
          </div>
        ))}
      </div>
    </div>
  );
}
