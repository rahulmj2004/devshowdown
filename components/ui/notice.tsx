import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warn" | "danger";

const styles: Record<Tone, string> = {
  info: "border-cyan/25 bg-cyan/[0.06] [&_svg]:text-cyan",
  success: "border-success/30 bg-success/[0.07] [&_svg]:text-success",
  warn: "border-warn/30 bg-warn/[0.07] [&_svg]:text-warn",
  danger: "border-danger/35 bg-danger/[0.07] [&_svg]:text-danger",
};

const icons = {
  info: Info,
  success: CircleCheck,
  warn: TriangleAlert,
  danger: CircleAlert,
} as const;

/** Inline status message. `live` announces it to screen readers when it appears. */
export function Notice({
  tone = "info",
  title,
  children,
  live = false,
  className,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
  live?: boolean;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={live ? (tone === "danger" ? "alert" : "status") : undefined}
      className={cn(
        "flex gap-3 rounded-[3px] border p-4 text-sm",
        styles[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-fg">{title}</p>
        {children && (
          <div className="mt-1 leading-relaxed text-muted">{children}</div>
        )}
      </div>
    </div>
  );
}
