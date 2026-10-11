"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, margin: "0px 0px -72px 0px" } as const;

/**
 * A coordinator's portrait. It wipes up into view while settling back from a
 * slight zoom the first time it is scrolled to; with reduced motion it simply
 * appears. Hover effects come from the card's `.group`.
 */
export function CoordinatorPhoto({
  src,
  alt,
  delay = 0,
}: {
  src: string;
  alt: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const timing = (duration: number) =>
    reduceMotion ? { duration: 0 } : { duration, delay, ease: EASE };

  return (
    <motion.div
      data-reveal=""
      className="absolute inset-0"
      initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={VIEWPORT}
      transition={timing(1.1)}
    >
      <motion.div
        data-reveal=""
        className="absolute inset-0"
        initial={{ scale: 1.22 }}
        whileInView={{ scale: 1 }}
        viewport={VIEWPORT}
        transition={timing(1.7)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 92vw"
          className="object-cover grayscale transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.06] group-hover:brightness-110 group-hover:contrast-[1.05]"
        />
      </motion.div>
    </motion.div>
  );
}
