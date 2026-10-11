"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFinePointer } from "./use-fine-pointer";

const spring = { stiffness: 220, damping: 16, mass: 0.4 };

/**
 * Pulls its child a few pixels toward the mouse. Purely visual: the child
 * keeps its own semantics, focus and click target, and nothing moves for
 * touch, keyboard or reduced-motion users.
 */
export function Magnetic({
  children,
  strength = 0.28,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, spring);
  const springY = useSpring(y, spring);
  const enabled = finePointer && !reduceMotion;

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      className={cn("inline-flex", className)}
      style={{ x: springX, y: springY }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
    >
      {children}
    </motion.span>
  );
}
