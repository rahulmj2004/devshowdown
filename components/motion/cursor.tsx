"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useEffect, useState } from "react";
import { useFinePointer } from "./use-fine-pointer";

const INTERACTIVE =
  "a, button, summary, label, input, select, textarea, [role='button'], [data-cursor]";

/**
 * A ring that trails the mouse and swells over interactive elements. It is an
 * addition to the native cursor, never a replacement, ignores pointer events,
 * and is not rendered at all on touch devices or with reduced motion.
 */
export function CursorRing() {
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const enabled = finePointer && !reduceMotion;

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 420, damping: 34, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 420, damping: 34, mass: 0.5 });
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);
      const target = event.target;
      setActive(target instanceof Element && !!target.closest(INTERACTIVE));
    };
    const onLeave = () => setVisible(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[75] -mt-4 -ml-4 size-8 rounded-full border border-lime/70 mix-blend-difference"
      style={{ x: springX, y: springY }}
      animate={{
        opacity: visible ? 1 : 0,
        scale: active ? 1.7 : 1,
        backgroundColor: active ? "rgba(200,255,46,0.14)" : "rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
