import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * A slow ticker of display type between sections. Decorative: the same words
 * appear as real headings elsewhere, so it is hidden from assistive tech.
 */
export function Marquee({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) {
  const run = (
    <div className="flex shrink-0 items-center">
      {items.map((item, index) => (
        <Fragment key={item}>
          <span
            className={cn(
              "px-6 display text-5xl sm:px-9 sm:text-7xl",
              index % 2 === 0
                ? "text-fg"
                : "text-outline [--outline-color:#ffffff66]",
            )}
          >
            {item}
          </span>
          <svg
            viewBox="0 0 24 24"
            className="size-5 shrink-0 text-lime sm:size-7"
            fill="currentColor"
          >
            <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
          </svg>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden border-y border-line bg-bg-soft py-5 select-none sm:py-7",
        className,
      )}
    >
      <div className="flex w-max animate-marquee">
        {run}
        {run}
      </div>
    </div>
  );
}
