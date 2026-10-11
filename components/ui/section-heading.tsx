import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RevealText } from "./reveal";

/**
 * Section title block: a mono annotation line over oversized display type.
 * A string `title` animates in word by word; pass a node to opt out.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  index,
  align = "left",
  id,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Two-digit section marker, e.g. "02". */
  index?: string;
  align?: "left" | "center";
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-3 eyebrow text-lime",
          align === "center" && "justify-center",
        )}
      >
        {index && (
          <span aria-hidden="true" className="text-subtle">
            {index}
          </span>
        )}
        <span aria-hidden="true" className="h-px w-8 bg-lime/60" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-5 display text-[2.75rem] text-fg sm:text-6xl lg:text-7xl"
      >
        {typeof title === "string" ? <RevealText text={title} /> : title}
      </h2>
      {description && (
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
