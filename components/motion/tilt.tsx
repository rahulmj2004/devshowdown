"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFinePointer } from "./use-fine-pointer";

const spring = { stiffness: 180, damping: 20, mass: 0.6 };

/**
 * Restrained 3D tilt with a light that tracks the mouse. Mouse only: touch,
 * keyboard and reduced-motion users get the same content, flat and still.
 */
export function Tilt({
  children,
  className,
  max = 4,
}: {
  children: ReactNode;
  className?: string;
  /** Largest rotation in degrees. */
  max?: number;
}) {
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const enabled = finePointer && !reduceMotion;

  const rotateX = useSpring(useMotionValue(0), spring);
  const rotateY = useSpring(useMotionValue(0), spring);
  const lightX = useMotionValue(50);
  const lightY = useMotionValue(50);
  const light = useMotionTemplate`radial-gradient(26rem circle at ${lightX}% ${lightY}%, rgba(255,255,255,0.075), transparent 62%)`;

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    rotateY.set((x - 0.5) * 2 * max);
    rotateX.set((0.5 - y) * 2 * max);
    lightX.set(x * 100);
    lightY.set(y * 100);
  };
  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      className={cn("group/tilt relative", className)}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
    >
      {children}
      {enabled && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
          style={{ background: light }}
        />
      )}
    </motion.div>
  );
}
