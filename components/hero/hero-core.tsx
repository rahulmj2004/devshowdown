"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface NetworkInformationLike {
  saveData?: boolean;
}

/**
 * Skip WebGL where it is unavailable or likely to cost more than it is worth.
 * Support is probed on a throwaway canvas first, so a browser without WebGL
 * never downloads Three.js at all and nothing is logged as an error.
 */
function shouldSkipWebGL(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection;
  if (connection?.saveData) return true;
  if ((navigator.hardwareConcurrency ?? 4) <= 2) return true;
  try {
    const probe = document.createElement("canvas");
    return !(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return true;
  }
}

/**
 * CSS/SVG rendition of the core. It is what paints first, what stays when
 * WebGL is unavailable or skipped, and what the canvas cross-fades over.
 */
function CoreFallback({ hidden }: { hidden: boolean }) {
  return (
    <div
      data-hidden={hidden}
      className="core-fallback absolute inset-0 flex items-center justify-center"
    >
      <div className="relative aspect-square w-[62%]">
        <div className="absolute inset-[-6%] rounded-full bg-violet/25 blur-3xl" />
        <div className="core-ring animate-spin-slower [border-style:dashed]" />
        <div className="core-ring inset-[9%]! border-cyan/25!" />
        <svg
          viewBox="0 0 200 200"
          fill="none"
          className="absolute inset-[14%] animate-spin-slow"
        >
          <g stroke="#a98bff" strokeOpacity="0.7" strokeWidth="0.7">
            <path d="M100 8 180 54v92l-80 46-80-46V54z" />
            <path d="M100 8 20 146h160zM100 192 20 54h160z" />
            <path d="M100 8v184M20 54l160 92M180 54 20 146" />
          </g>
          <g stroke="#c8ff2e" strokeWidth="1.1">
            <path d="M100 62 133 119H67z" fill="#08080b" />
            <path d="M100 62v57M67 119l33-19 33 19" strokeOpacity="0.6" />
          </g>
          <g fill="#c8ff2e">
            <circle cx="100" cy="8" r="2.2" />
            <circle cx="180" cy="54" r="2.2" />
            <circle cx="180" cy="146" r="2.2" />
            <circle cx="100" cy="192" r="2.2" />
            <circle cx="20" cy="146" r="2.2" />
            <circle cx="20" cy="54" r="2.2" />
          </g>
        </svg>
      </div>
    </div>
  );
}

/**
 * The hero's 3D core. Three.js is fetched only on the client, only after the
 * page is idle, and never blocks the content: until its first frame (or
 * forever, if WebGL is missing) the CSS fallback is what you see.
 */
export function HeroCore({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || shouldSkipWebGL()) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;

    const boot = async () => {
      try {
        const { mountHeroScene } = await import("./hero-scene");
        if (cancelled) return;
        dispose = mountHeroScene(canvas, {
          reduceMotion: !!reduceMotion,
          lite: window.innerWidth < 768,
          onFirstFrame: () => setLive(true),
          onContextLost: () => setLive(false),
        });
      } catch {
        // No WebGL (or the chunk failed to load): the fallback stays.
        setLive(false);
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

  return (
    <div aria-hidden="true" className={cn("relative", className)}>
      <CoreFallback hidden={live} />
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-1000 ease-out",
          live ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
