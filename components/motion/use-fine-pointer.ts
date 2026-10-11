"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(hover: hover) and (pointer: fine)";

/** `matchMedia` is missing in some embedded and test environments. */
const query = () =>
  typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;

function subscribe(onChange: () => void) {
  const media = query();
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/**
 * True on devices with a mouse-like pointer. Pointer-driven effects (tilt,
 * magnetic buttons, the cursor ring) are skipped everywhere else. Always false
 * during server rendering, so those effects are a progressive enhancement.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  );
}
