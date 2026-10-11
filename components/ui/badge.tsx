import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "violet" | "cyan" | "success" | "warn";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line-strong bg-white/[0.04] text-muted",
  violet: "border-violet-bright/30 bg-violet/15 text-violet-bright",
  cyan: "border-cyan/30 bg-cyan/10 text-cyan",
  success: "border-success/30 bg-success/10 text-success",
  warn: "border-warn/30 bg-warn/10 text-warn",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-subtle",
  violet: "bg-violet-bright",
  cyan: "bg-cyan",
  success: "bg-success",
  warn: "bg-warn",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dots[tone])}
        />
      )}
      {children}
    </span>
  );
}

/** Marks a detail the organizer has not confirmed. Never a guessed value. */
export function Tba({ label = "Awaiting confirmation" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-dashed border-line-strong px-2 py-0.5 font-mono text-xs text-subtle">
      {label}
    </span>
  );
}
