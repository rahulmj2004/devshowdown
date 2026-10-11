"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribe(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}
const nowInSeconds = () => Math.floor(Date.now() / 1000);

const UNITS = [
  { label: "Days", seconds: 86_400 },
  { label: "Hrs", seconds: 3_600 },
  { label: "Min", seconds: 60 },
  { label: "Sec", seconds: 1 },
] as const;

/**
 * Counts down to the configured start instant. Until `details.startsAt` is set
 * in `config/site.ts` it shows empty cells and says so; it never counts toward
 * a made-up date. The server renders the empty state and the client fills it
 * in, so the markup always matches on hydration.
 */
export function Countdown({
  startsAt,
  className,
}: {
  /** ISO 8601 instant, or null while the date is unconfirmed. */
  startsAt: string | null;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, nowInSeconds, () => null);
  const target = startsAt ? Math.floor(Date.parse(startsAt) / 1000) : null;
  const configured = target !== null && Number.isFinite(target);
  const remaining =
    configured && now !== null ? Math.max(target - now, 0) : null;
  const started = configured && now !== null && target <= now;

  // Each unit shows what is left over after the larger units are taken out.
  const total = remaining ?? 0;
  const cells = UNITS.map((unit, index) => {
    const larger = index === 0 ? Infinity : UNITS[index - 1].seconds;
    return {
      label: unit.label,
      value: Math.floor((total % larger) / unit.seconds),
    };
  });

  const summary = !configured
    ? "Countdown starts once the event date is announced."
    : started
      ? "The event has started."
      : remaining === null
        ? "Loading countdown."
        : `${cells[0].value} days, ${cells[1].value} hours and ${cells[2].value} minutes until the event starts.`;

  return (
    <div className={className}>
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true" className="grid grid-cols-4 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="border border-line bg-white/[0.02] px-2 py-2.5 text-center"
          >
            <span
              className={cn(
                "block display text-3xl tabular-nums sm:text-4xl",
                remaining === null ? "text-subtle/60" : "text-fg",
              )}
            >
              {remaining === null ? "--" : String(cell.value).padStart(2, "0")}
            </span>
            <span className="mt-1 block eyebrow text-[0.625rem] text-subtle">
              {cell.label}
            </span>
          </div>
        ))}
      </div>
      <p
        aria-hidden="true"
        className="mt-2.5 font-mono text-[11px] text-subtle"
      >
        {!configured
          ? "// countdown starts when the date is announced"
          : started
            ? "// the showdown has begun"
            : "// until the showdown begins"}
      </p>
    </div>
  );
}
