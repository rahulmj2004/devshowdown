"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFinePointer } from "@/components/motion/use-fine-pointer";

/**
 * Moves its children at a fraction of the scroll speed, for layered depth.
 * `speed` is the share of scroll distance added as offset (negative lifts).
 */
export function ParallaxLayer({
  children,
  speed,
  className,
}: {
  children: ReactNode;
  speed: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(
    scrollY,
    [0, 1000],
    [0, reduceMotion ? 0 : 1000 * speed],
  );

  return (
    <motion.div className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}

/** A soft light that follows the mouse across the hero. Desktop only. */
export function PointerLight() {
  const ref = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const enabled = finePointer && !reduceMotion;

  const x = useMotionValue(0.7);
  const y = useMotionValue(0.35);
  const springX = useSpring(x, { stiffness: 60, damping: 20 });
  const springY = useSpring(y, { stiffness: 60, damping: 20 });
  const left = useTransform(springX, (value) => `${value * 100}%`);
  const top = useTransform(springY, (value) => `${value * 100}%`);
  const background = useMotionTemplate`radial-gradient(42rem circle at ${left} ${top}, rgba(123,61,255,0.22), transparent 62%)`;

  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: PointerEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0) return;
      x.set((event.clientX - rect.left) / rect.width);
      y.set((event.clientY - rect.top) / rect.height);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, x, y]);

  return (
    <motion.div ref={ref} className="absolute inset-0" style={{ background }} />
  );
}
