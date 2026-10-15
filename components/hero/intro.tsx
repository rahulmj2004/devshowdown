"use client";

import { useEffect, type CSSProperties } from "react";
import { Wordmark } from "@/components/layout/logo";

/** Long enough for the intro and every hero entrance to have finished. */
const CLEANUP_AFTER_MS = 4800;

const bootLines = ["mount /arena", "load competitions", "ready"];

/** CSS owns visibility; this effect only retires the root flag after the sequence. */
export function Intro() {
  useEffect(() => {
    const root = document.documentElement;

    // A completed intro should not delay the hero when the home page is revisited.
    if (root.getAttribute("data-intro") === "done") {
      root.removeAttribute("data-intro");
    }
    if (root.getAttribute("data-intro") !== "play") {
      return;
    }

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
