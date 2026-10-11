import type { CSSProperties } from "react";
import type { Accent } from "@/types";

/** Hex values for each arena accent, matching the tokens in globals.css. */
export const accentColor: Record<Accent, string> = {
  violet: "#a98bff",
  cyan: "#7fe9ff",
  lime: "#c8ff2e",
  rose: "#ff4d6a",
};

/** Inline style that exposes an arena's colour to its subtree as `--accent`. */
export function accentStyle(accent: Accent): CSSProperties {
  return { "--accent": accentColor[accent] } as CSSProperties;
}
