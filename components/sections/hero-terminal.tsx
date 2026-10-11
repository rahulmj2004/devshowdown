import type { CSSProperties } from "react";
import type { EventConfig } from "@/types";

const TYPE_SPEED = 0.042;
const COMMAND = "./showdown --init";
const SIGN_OFF = "enter the arena.";

const vars = (values: Record<string, string | number>) =>
  values as CSSProperties;

/**
 * Decorative terminal that "boots" the event. The typing is pure CSS (see
 * `type-line` and `appear` in globals.css), so it costs no client JavaScript,
 * renders complete without it, and collapses to its end state under reduced
 * motion. The round list is generated from the event config.
 */
export function HeroTerminal({
  events,
  prizeLabel,
  prizeApproximate,
}: {
  events: readonly EventConfig[];
  prizeLabel: string;
  prizeApproximate: boolean;
}) {
  const slugWidth = Math.max(...events.map((event) => event.slug.length)) + 2;
  const commandDone = 0.7 + COMMAND.length * TYPE_SPEED;
  const lineDelay = (index: number) => `${commandDone + 0.25 + index * 0.26}s`;
  const signOffDelay = commandDone + 0.25 + (events.length + 1) * 0.26 + 0.35;

  return (
    <div aria-hidden="true" className="relative w-full min-w-0">
      <div className="relative overflow-hidden border border-line-strong bg-bg shadow-[0_40px_90px_-40px_#000]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-lime/80" />
          <span className="ml-3 font-mono text-xs text-subtle">
            showdown — zsh
          </span>
        </div>

        <div className="overflow-hidden p-5 font-mono text-xs leading-7 sm:text-[13px]">
          <p className="whitespace-pre">
            <span className="text-lime">$ </span>
            <span
              className="type-line text-fg"
              style={vars({ "--chars": COMMAND.length, "--delay": "0.7s" })}
            >
              {COMMAND}
            </span>
          </p>

          {events.map((event, index) => (
            <p
              key={event.slug}
              className="appear whitespace-pre text-muted"
              style={vars({ "--delay": lineDelay(index) })}
            >
              <span className="text-lime">{"  ✓ "}</span>
              {event.slug.padEnd(slugWidth)}
              <span className="text-subtle">loaded</span>
            </p>
          ))}

          <p
            className="appear whitespace-pre text-muted"
            style={vars({ "--delay": lineDelay(events.length) })}
          >
            <span className="text-cyan">{"  ◆ "}</span>
            {"prize_pool".padEnd(slugWidth)}
            <span className="text-fg">
              {prizeApproximate ? "~" : ""}
              {prizeLabel}
            </span>
          </p>

          <p className="mt-2 whitespace-pre">
            <span className="text-lime">$ </span>
            <span
              className="type-line text-fg"
              style={vars({
                "--chars": SIGN_OFF.length,
                "--delay": `${signOffDelay}s`,
              })}
            >
              {SIGN_OFF}
            </span>
            <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-caret bg-lime" />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-white/[0.02] px-5 py-2.5 font-mono text-[11px] text-subtle">
          <span>
            arenas <span className="text-fg">{events.length}</span>
          </span>
          <span>
            exit <span className="text-fg">0</span>
          </span>
        </div>
      </div>
    </div>
  );
}
