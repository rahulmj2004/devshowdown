"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A rail that fills as its parent scrolls through the viewport. Used to draw
 * the journey and schedule timelines. With reduced motion it is simply full:
 * that is done in CSS (`.progress-fill`), so the server and the browser
 * render identical markup whatever the visitor's motion preference.
 */
export function ProgressLine({
  orientation,
  className,
}: {
  orientation: "horizontal" | "vertical";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 55%"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const horizontal = orientation === "horizontal";

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("bg-line-strong", className)}
    >
      <motion.div
        className={cn(
          "progress-fill size-full bg-lime",
          horizontal ? "origin-left" : "origin-top",
        )}
        style={horizontal ? { scaleX: progress } : { scaleY: progress }}
      />
    </div>
  );
}
