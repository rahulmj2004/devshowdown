"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, margin: "0px 0px -72px 0px" } as const;

/**
 * Fades content up the first time it scrolls into view. With reduced motion
 * the content simply appears. `data-reveal` lets the <noscript> rule in the
 * root layout keep it visible when JavaScript is unavailable.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.75, delay, ease: EASE }
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Heading text whose words rise out of a mask, one after another, when the
 * heading scrolls into view. Screen readers get the plain sentence.
 */
export function RevealText({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  return (
    <motion.span
      className={cn("inline", className)}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      transition={{
        staggerChildren: reduceMotion ? 0 : 0.07,
        delayChildren: delay,
      }}
    >
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="-mt-[0.08em] inline-block overflow-hidden pt-[0.08em] align-bottom"
        >
          <motion.span
            data-reveal=""
            className="inline-block"
            variants={{
              hidden: { y: "108%" },
              shown: {
                y: 0,
                transition: reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.9, ease: EASE },
              },
            }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
