"use client";

import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn, formatRupees } from "@/lib/utils";
import type { PrizeTier } from "@/types";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Visual order is 2nd, 1st, 3rd; `place` is the real ranking. */
const steps = [
  { place: 2, height: "h-32 sm:h-44", delay: 0.12, tone: "text-cyan" },
  { place: 1, height: "h-44 sm:h-60", delay: 0, tone: "text-lime" },
  { place: 3, height: "h-24 sm:h-32", delay: 0.24, tone: "text-violet-bright" },
] as const;

const fallbackLabels = ["1st place", "2nd place", "3rd place"];

/**
 * Winner podium. The steps rise when scrolled into view. Amounts come from
 * `prize.distribution`; until that is set each step reads "TBA".
 */
export function Podium({ tiers }: { tiers: readonly PrizeTier[] | null }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2 sm:gap-4">
      {steps.map((step) => {
        const tier = tiers?.[step.place - 1];
        const label = tier?.label ?? fallbackLabels[step.place - 1];
        return (
          // `order` keeps the DOM in ranking order for assistive tech.
          <li
            key={step.place}
            className={cn(
              "flex flex-col items-center",
              step.place === 1 && "order-2",
              step.place === 2 && "order-1",
              step.place === 3 && "order-3",
            )}
          >
            <motion.div
              className="mb-3 text-center"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{
                duration: reduceMotion ? 0 : 0.6,
                delay: reduceMotion ? 0 : 0.5 + step.delay,
                ease: EASE,
              }}
            >
              {step.place === 1 && (
                <Trophy
                  aria-hidden="true"
                  className="mx-auto mb-2 size-7 text-lime"
                />
              )}
              <p className="eyebrow text-subtle">{label}</p>
              <p
                className={cn(
                  "mt-1 display text-2xl sm:text-4xl",
                  tier ? "text-fg" : "text-subtle/70",
                )}
              >
                {tier ? formatRupees(tier.amount) : "TBA"}
              </p>
              {tier?.note && (
                <p className="mt-1 text-xs text-muted">{tier.note}</p>
              )}
            </motion.div>
            <motion.div
              aria-hidden="true"
              className={cn(
                "relative w-full origin-bottom overflow-hidden border border-b-0 border-line-strong bg-linear-to-b from-surface-2 to-bg",
                step.height,
              )}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{
                duration: reduceMotion ? 0 : 0.9,
                delay: reduceMotion ? 0 : step.delay,
                ease: EASE,
              }}
            >
              <span className="absolute inset-x-0 top-0 h-px bg-current opacity-80" />
              <span
                className={cn(
                  "absolute inset-x-0 top-3 text-center display text-5xl sm:text-7xl",
                  step.tone,
                )}
              >
                {step.place}
              </span>
              <span className="absolute inset-0 bg-grid-flat opacity-60" />
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
