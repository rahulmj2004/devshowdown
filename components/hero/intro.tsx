"use client";

import { useEffect, type CSSProperties } from "react";
import { Wordmark } from "@/components/layout/logo";

/** Long enough for the intro and every hero entrance to have finished. */
const CLEANUP_AFTER_MS = 4800;

const bootLines = ["mount /arena", "load competitions", "ready"];

/**
 * Opening sequence markup. The animation itself is CSS (see `.intro` in
 * globals.css) and only exists while <html data-intro="play">, which the
 * inline script in the root layout sets at most once per session.
 *
 * This component retires that attribute in two steps. Once the sequence has
 * finished it becomes "done", which hides the overlay but leaves the hero's
 * animation delay untouched (changing it would replay the hero). The next
 * time the home page is shown, "done" is dropped, so the hero starts at once.
 */
export function Intro() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-intro") === "done") {
      root.removeAttribute("data-intro");
    }
    if (root.getAttribute("data-intro") !== "play") return;
    const timer = window.setTimeout(
      () => root.setAttribute("data-intro", "done"),
      CLEANUP_AFTER_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div aria-hidden="true" className="intro">
      <div className="w-[min(86vw,34rem)]">
        <div className="intro-word">
          <Wordmark className="text-[clamp(2.5rem,11vw,5rem)]" />
        </div>
        <div className="mt-5 h-px w-full bg-line-strong">
          <div className="intro-bar h-px w-full bg-lime" />
        </div>
        <ul className="mt-4 space-y-1 font-mono text-[11px] text-subtle">
          {bootLines.map((line, index) => (
            <li
              key={line}
              className="intro-line"
              style={{ "--d": `${0.12 + index * 0.2}s` } as CSSProperties}
            >
              <span className="text-lime">{">"}</span> {line}
              {index === bootLines.length - 1 ? "" : " ..."}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
