"use client";

import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

/**
 * The hacker who runs along the bottom of the window as the page scrolls (see
 * `mountRunnerScene`). Pure decoration on a canvas that ignores input: the
 * scene is fetched once the page is idle, and with reduced motion it never
 * loads. The canvas is added to <body> by hand, because the page's own
 * wrappers would otherwise pin a fixed element to the page, not the window.
 */
export function HackerRunner() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className =
      "pointer-events-none fixed inset-x-0 bottom-0 z-40 h-40 w-full";
    document.body.append(canvas);

    let cancelled = false;
    let dispose: (() => void) | undefined;

    const boot = async () => {
      try {
        const { mountRunnerScene } = await import("./runner-scene");
        if (cancelled) return;
        dispose = mountRunnerScene(canvas);
      } catch {
        // The chunk failed to load: the page simply goes without.
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
      canvas.remove();
    };
  }, [reduceMotion]);

  return null;
}
