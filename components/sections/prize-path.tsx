"use client";

import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface PrizeStage {
  /** Who is still in at this stage, e.g. "Top 5 teams". */
  who: string;
  /** When it happens, e.g. "Morning". */
  when: string;
  text: string;
}

const heights = ["h-24 sm:h-28", "h-36 sm:h-44", "h-48 sm:h-60"];
const tones = ["text-violet-bright", "text-cyan", "text-lime"];

/**
 * The road to the prize: each stage is a taller step with fewer teams on it.
 * Shown while the split of the prize money has not been announced; once
 * `prize.distribution` is set the podium takes over.
 */
export function PrizePath({ stages }: { stages: readonly PrizeStage[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="mx-auto grid max-w-4xl items-end gap-3 sm:grid-cols-3 sm:gap-4">
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        return (
          <li key={stage.who} className="flex flex-col">
            <motion.div
              className="mb-4 px-1 text-center"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{
                duration: reduceMotion ? 0 : 0.6,
                delay: reduceMotion ? 0 : 0.35 + index * 0.14,
                ease: EASE,
              }}
            >
              {last && (
                <Trophy
                  aria-hidden="true"
                  className="mx-auto mb-2 size-7 text-lime"
                />
              )}
              <p className="eyebrow text-subtle">{stage.when}</p>
              <p
                className={cn(
                  "mt-1.5 display text-3xl sm:text-4xl",
                  last ? "text-lime" : "text-fg",
                )}
              >
                {stage.who}
              </p>
              <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">
                {stage.text}
              </p>
            </motion.div>

            {/* The step itself rises from the floor. Hidden on phones, where
                the stages simply stack. */}
            <motion.div
              aria-hidden="true"
              className={cn(
                "relative hidden origin-bottom border border-b-0 border-line-strong bg-linear-to-b from-surface-2 to-bg sm:block",
                last && "border-lime/50",
                heights[Math.min(index, heights.length - 1)],
              )}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{
                duration: reduceMotion ? 0 : 0.9,
                delay: reduceMotion ? 0 : index * 0.14,
                ease: EASE,
              }}
            >
              <span className="absolute inset-0 bg-grid opacity-40" />
              <span
                className={cn(
                  "absolute inset-x-0 top-4 text-center display text-6xl",
                  tones[Math.min(index, tones.length - 1)],
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
