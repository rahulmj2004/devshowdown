"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

interface NetworkInformationLike {
  saveData?: boolean;
}

/** Phones, data-saver sessions and weak CPUs get a lighter fire. */
function prefersLite(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection;
  return (
    window.innerWidth < 768 ||
    !!connection?.saveData ||
    (navigator.hardwareConcurrency ?? 4) <= 2
  );
}

/**
 * The hero's dragon, the fire it sets to the wordmark and the lightning behind
 * them. It is pure decoration on canvases that ignore input: the scene is
 * fetched once the page is idle, and with reduced motion it never loads (no
 * flashes, and the wordmark stays exactly as it is). Its partners are found
 * inside the same section: the wordmark by `data-fire-wordmark`, the sky
 * canvas by `data-storm-sky`.
 */
export function DragonFire({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduceMotion) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;

    const boot = async () => {
      try {
        const { mountDragonScene } = await import("./dragon-scene");
        if (cancelled) return;
        const hero = canvas.closest("section");
        dispose = mountDragonScene(canvas, {
          lite: prefersLite(),
          wordmark:
            hero?.querySelector<HTMLElement>("[data-fire-wordmark]") ?? null,
          sky:
            hero?.querySelector<HTMLCanvasElement>("[data-storm-sky]") ?? null,
        });
      } catch {
        // The chunk failed to load: the hero simply goes without.
      }
    };

    // Safari has no requestIdleCallback; a short timer does the same job.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle
      ? window.requestIdleCallback(boot, { timeout: 1500 })
      : window.setTimeout(boot, 300);

    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      dispose?.();
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
