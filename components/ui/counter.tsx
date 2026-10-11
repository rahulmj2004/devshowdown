"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { formatNumber } from "@/lib/utils";

/**
 * Counts up to `value` the first time it scrolls into view. The server renders
 * the final number, so it is correct without JavaScript, and assistive tech
 * always reads the final value rather than the ticking digits.
 */
export function Counter({
  value,
  prefix = "",
  className,
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduceMotion) return;

    const controls = animate(0, value, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = prefix + formatNumber(Math.round(latest));
      },
    });
    return () => {
      controls.stop();
      node.textContent = prefix + formatNumber(value);
    };
  }, [inView, prefix, reduceMotion, value]);

  const finalText = prefix + formatNumber(value);
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {finalText}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
