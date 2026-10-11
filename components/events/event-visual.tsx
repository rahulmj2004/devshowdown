import { EyeOff, Terminal } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Accent, EventVisualKind } from "@/types";
import { accentStyle } from "./accent";

/**
 * Decorative, CSS/SVG-only illustration for an event: one distinct scene per
 * competition. Purely presentational: hidden from assistive tech, shipped
 * without client JavaScript, and reacting to hover through the nearest
 * `.group` ancestor (the arena card).
 */
export function EventVisual({
  kind,
  accent,
  className,
}: {
  kind: EventVisualKind;
  accent: Accent;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-full w-full overflow-hidden bg-bg-soft select-none",
        className,
      )}
      style={{
        ...accentStyle(accent),
        backgroundImage:
          "radial-gradient(120% 90% at 50% -20%, color-mix(in oklab, var(--accent) 20%, transparent), transparent 62%)",
      }}
    >
      {visuals[kind]}
    </div>
  );
}

const vars = (values: Record<string, string | number>) =>
  values as CSSProperties;

const K = ({ children }: { children: ReactNode }) => (
  <span className="text-violet-bright">{children}</span>
);
const S = ({ children }: { children: ReactNode }) => (
  <span className="text-lime">{children}</span>
);
const N = ({ children }: { children: ReactNode }) => (
  <span className="text-cyan">{children}</span>
);

function WindowBar({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-line bg-white/[0.02] px-3 py-2">
      <span className="size-2 rounded-full bg-white/15" />
      <span className="size-2 rounded-full bg-white/15" />
      <span className="size-2 rounded-full bg-white/15" />
      <span className="ml-2 font-mono text-[10px] text-subtle">{title}</span>
      <span className="ml-auto">{children}</span>
    </div>
  );
}

function Line({
  n,
  children,
  className,
}: {
  n: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex whitespace-pre", className)}>
      <span className="w-8 shrink-0 pr-3 text-right text-subtle/50">{n}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------ debugging */
function DebugVisual() {
  return (
    <div className="absolute inset-0 flex flex-col p-4 sm:p-6">
      <div className="relative flex-1 overflow-hidden border border-line bg-bg/80">
        <WindowBar title="cart.js — crashed">
          {/* The error count resolves while the card is hovered or focused. */}
          <span className="relative block font-mono text-[10px]">
            <span className="text-rose transition-opacity duration-200 group-focus-within:opacity-0 group-hover:opacity-0">
              ✕ 1 error
            </span>
            <span className="absolute inset-y-0 right-0 whitespace-nowrap text-lime opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
              ✓ 0 errors
            </span>
          </span>
        </WindowBar>
        <div className="relative py-3 font-mono text-[11px] leading-[1.75] text-muted">
          <Line n={12}>
            <K>function</K> total(items) {"{"}
          </Line>
          <Line n={13}>
            {"  "}
            <K>let</K> sum = <N>0</N>;
          </Line>
          <Line
            n={14}
            className="bg-rose/10 transition-colors duration-300 group-focus-within:bg-lime/10 group-hover:bg-lime/10"
          >
            {"  "}
            <K>for</K> (<K>let</K> i = <N>0</N>; i{" "}
            <span className="relative inline-block">
              <span className="text-rose underline decoration-rose decoration-wavy underline-offset-4 transition-opacity duration-200 group-focus-within:opacity-0 group-hover:opacity-0">
                {"<="}
              </span>
              <span className="absolute inset-0 text-lime opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
                {"< "}
              </span>
            </span>{" "}
            items.length; i++)
          </Line>
          <Line n={15}>{"    "}sum += items[i].price;</Line>
          <Line n={16}>{"  }"}</Line>
          <div className="scan-sweep pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-transparent via-rose/15 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-line bg-bg/90 px-3 py-2 font-mono text-[10px] leading-relaxed">
          <p className="truncate text-rose">
            TypeError: Cannot read properties of undefined (reading
            &apos;price&apos;)
          </p>
          <p className="truncate text-subtle">
            {"    "}at total (cart.js:15:23)
          </p>
        </div>
      </div>
      {/* Corrupted memory strip. */}
      <p className="mt-3 truncate font-mono text-[10px] tracking-[0.2em] text-rose/50">
        0x7F 3A ██ 00 E4 ▓▓ 1C 9B ░░ FF 02 ██ A0 5D ▓▓ 44 0B ░░ C3 ██ 6E 91
      </p>
    </div>
  );
}

/* --------------------------------------------------------- blind coding */
const redactions = [58, 82, 44, 70, 52];

function BlindVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-7">
      <div className="relative w-full max-w-md">
        {/* A monitor with nothing to read on it. */}
        <div className="relative overflow-hidden border border-line-strong bg-black">
          <div className="absolute inset-0 bg-scanlines opacity-60" />
          <div className="relative space-y-2.5 px-5 py-4">
            {redactions.map((width, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-4 text-right font-mono text-[10px] text-white/20">
                  {index + 1}
                </span>
                <span
                  className="redact block h-2.5 bg-white/[0.13] transition-colors duration-300 group-hover:bg-white/[0.2]"
                  style={{
                    ...vars({ "--i": index }),
                    width: `${width}%`,
                    marginLeft: `${(index % 3) * 6}%`,
                  }}
                />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-0.5">
              <span className="w-4 text-right font-mono text-[10px] text-white/20">
                {redactions.length + 1}
              </span>
              <span className="font-mono text-xs tracking-[0.3em] text-(--accent)">
                ••••••
              </span>
              <span className="inline-block h-3.5 w-1.5 animate-caret bg-(--accent)" />
            </div>
          </div>
          <div className="relative flex items-center justify-between border-t border-white/10 px-4 py-2 font-mono text-[10px] text-white/40">
            <span className="flex items-center gap-1.5">
              <EyeOff className="size-3" /> display off
            </span>
            <span>input only</span>
          </div>
        </div>
        {/* Stamped across the screen when someone tries to look. */}
        <p className="absolute top-1/2 left-1/2 -translate-1/2 scale-110 -rotate-6 border-2 border-(--accent) bg-black/85 px-4 py-1.5 display text-2xl whitespace-nowrap text-(--accent) opacity-0 transition-[opacity,transform] duration-300 ease-out group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100 sm:text-3xl">
          No peeking
        </p>
        <div className="mx-auto h-3 w-16 border-x border-line-strong" />
        <div className="mx-auto h-px w-28 bg-line-strong" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------- treasure hunt */
const contours = [
  "M-10 62C40 30 92 34 134 58s86 34 132 8 60-20 70-14",
  "M-10 92c44-28 96-24 140 2s92 34 136 6 52-18 64-10",
  "M-10 124c50-24 100-18 144 8s94 30 134 4 50-14 62-8",
  "M-10 156c52-20 104-12 148 12s92 24 132 2 46-10 60-6",
  "M-10 32C36 8 88 10 130 30s84 30 134 6 62-22 70-16",
];
const clues = [
  { x: 46, y: 148, glyph: "△", label: "clue_01" },
  { x: 124, y: 86, glyph: "◇", label: "clue_02" },
  { x: 204, y: 128, glyph: "○", label: "clue_03" },
];

function HuntVisual() {
  return (
    <svg
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      fill="none"
    >
      {/* Map fragment: contour lines over a coordinate grid. */}
      <g stroke="currentColor" className="text-white/[0.07]">
        {[40, 80, 120, 160, 200, 240, 280].map((x) => (
          <path key={x} d={`M${x} 0v200`} />
        ))}
        {[40, 80, 120, 160].map((y) => (
          <path key={y} d={`M0 ${y}h320`} />
        ))}
      </g>
      <g stroke="var(--accent)" strokeOpacity="0.22">
        {contours.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        fill="#82828e"
        fontSize="7"
        fontFamily="var(--font-mono)"
        letterSpacing="1"
      >
        <text x="44" y="34">
          X:041
        </text>
        <text x="44" y="44">
          Y:007
        </text>
        <text x="236" y="172">
          GRID C4
        </text>
      </g>

      {/* The trail between clues. */}
      <path
        d="M46 148C70 110 96 96 124 86s54 30 80 42 52-40 72-70"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="4 7"
        className="animate-dash"
      />
      {clues.map((clue) => (
        <g key={clue.label} transform={`translate(${clue.x} ${clue.y})`}>
          <circle r="9" fill="#0a0a0d" stroke="var(--accent)" />
          <text
            y="3.2"
            textAnchor="middle"
            fill="var(--accent)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {clue.glyph}
          </text>
          <text
            x="14"
            y="3"
            fill="#a6a6b0"
            fontSize="7.5"
            fontFamily="var(--font-mono)"
          >
            {clue.label}
          </text>
        </g>
      ))}

      {/* The unknown at the end of it. */}
      <g transform="translate(276 58)">
        <circle
          r="10"
          stroke="var(--accent)"
          className="animate-ping-soft"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        <circle
          r="10"
          fill="var(--accent)"
          fillOpacity="0.16"
          stroke="var(--accent)"
          strokeWidth="1.4"
          className="origin-center transition-transform duration-500 ease-out [transform-box:fill-box] group-hover:scale-125"
        />
        <path
          d="M-4-4 4 4M4-4-4 4"
          stroke="#f3f3ee"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <text
          x="-34"
          y="-16"
          fill="var(--accent)"
          fontSize="7.5"
          fontFamily="var(--font-mono)"
        >
          ??? unlocked
        </text>
      </g>
    </svg>
  );
}

/* --------------------------------------------------------- speed typing */
const streak = "the quick brown fox jumps over the lazy dog · ";
const typingKeys = ["A", "S", "D", "F", "J", "K", "L", ";"];

function TypingVisual() {
  return (
    <div className="absolute inset-0 flex flex-col justify-between py-5 sm:py-6">
      {/* Kinetic line: speeds up while the card is hovered. */}
      <div className="overflow-hidden">
        <p className="streak flex w-max display text-5xl text-outline [--outline-color:var(--accent)] [-webkit-text-stroke-width:1px] sm:text-6xl">
          <span className="whitespace-pre">{streak.repeat(2)}</span>
          <span className="whitespace-pre">{streak.repeat(2)}</span>
        </p>
      </div>

      <div className="flex items-end justify-between gap-6 px-5 sm:px-7">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm whitespace-nowrap">
            <span className="text-fg">fingers faster than th</span>
            <span className="-mb-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-caret bg-(--accent)" />
            <span className="text-subtle/50">ought</span>
          </p>
          <div className="mt-4 flex gap-1.5">
            {typingKeys.map((key, index) => (
              <span
                key={key}
                className="flex aspect-square max-w-9 flex-1 animate-key items-center justify-center rounded-[3px] border border-line-strong bg-surface-2 font-mono text-[11px] text-subtle"
                style={{ animationDelay: `${index * 0.4}s` }}
              >
                {key}
              </span>
            ))}
          </div>
        </div>

        {/* Speedometer. No number: it is a mood, not a statistic. */}
        <svg
          viewBox="0 0 200 124"
          fill="none"
          className="w-28 shrink-0 sm:w-36"
        >
          <path
            d="M20 100a80 80 0 0 1 160 0"
            stroke="#ffffff1f"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M20 100a80 80 0 0 1 160 0"
            stroke="var(--accent)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="251"
            strokeDashoffset="70"
          />
          <g stroke="#ffffff40" strokeWidth="1.5">
            <path d="M100 26v9M47 47l6 6M153 47l-6 6M27 100h9M173 100h-9" />
          </g>
          <path
            d="M100 100V38"
            stroke="#f3f3ee"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="needle"
          />
          <circle cx="100" cy="100" r="6" fill="var(--accent)" />
          <text
            x="100"
            y="121"
            textAnchor="middle"
            fill="#82828e"
            fontSize="11"
            fontFamily="var(--font-mono)"
            letterSpacing="3"
          >
            WPM
          </text>
        </svg>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- coding */
const minimap = [70, 40, 86, 60, 30, 76, 52, 90, 44, 66, 36, 80, 58, 24];

function CodeVisual() {
  const lines: ReactNode[] = [
    <>
      <K>def</K> <S>solve</S>(nums, target):
    </>,
    <>
      {"    "}seen = {"{}"}
    </>,
    <>
      {"    "}
      <K>for</K> i, n <K>in</K> enumerate(nums):
    </>,
    <>
      {"        "}
      <K>if</K> target - n <K>in</K> seen:
    </>,
    <>
      {"            "}
      <K>return</K> seen[target - n], i
    </>,
    <>{"        "}seen[n] = i</>,
    <>
      {"    "}
      <K>return</K> <N>None</N>
    </>,
  ];

  return (
    <div className="absolute inset-0 flex flex-col p-4 sm:p-6">
      <div className="flex flex-1 flex-col overflow-hidden border border-line bg-bg/80">
        {/* Tabs. */}
        <div className="flex border-b border-line font-mono text-[10px]">
          <span className="border-r border-line bg-white/[0.04] px-3 py-2 text-fg">
            <span className="mr-1.5 text-(--accent)">●</span>solution.py
          </span>
          <span className="border-r border-line px-3 py-2 text-subtle">
            tests.py
          </span>
          <span className="ml-auto px-3 py-2 text-subtle">O(n)</span>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 py-3 font-mono text-[11px] leading-[1.75] text-muted">
            {lines.map((line, index) => (
              <Line key={index} n={index + 1}>
                <span
                  className="code-write inline-block"
                  style={vars({ "--i": index })}
                >
                  {line}
                </span>
              </Line>
            ))}
          </div>
          {/* Minimap. */}
          <div className="hidden w-14 shrink-0 space-y-1 border-l border-line p-2 sm:block">
            {minimap.map((width, index) => (
              <span
                key={index}
                className={cn(
                  "block h-0.5",
                  index % 4 === 0 ? "bg-(--accent)/60" : "bg-white/15",
                )}
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </div>
        {/* Status bar. */}
        <div className="flex items-center gap-4 border-t border-line bg-(--accent)/10 px-3 py-1.5 font-mono text-[10px] text-subtle">
          <span className="text-(--accent)">main</span>
          <span>Ln 7, Col 16</span>
          <span className="ml-auto">UTF-8</span>
          <span>Python</span>
        </div>
      </div>
    </div>
  );
}

function GenericVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-grid" />
      <span className="relative flex size-14 items-center justify-center border border-line-strong bg-surface-2 text-(--accent)">
        <Terminal className="size-6" />
      </span>
    </div>
  );
}

const visuals: Record<EventVisualKind, ReactNode> = {
  typing: <TypingVisual />,
  debug: <DebugVisual />,
  blind: <BlindVisual />,
  code: <CodeVisual />,
  hunt: <HuntVisual />,
  generic: <GenericVisual />,
};
