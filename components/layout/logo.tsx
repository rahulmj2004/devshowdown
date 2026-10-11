import { cn } from "@/lib/utils";

/**
 * The DevShowdown mark: two shell prompts facing off across a cursor.
 * `app/icon.svg` is the same drawing, so keep them in sync.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <path d="M0 0h26l6 6v26H6l-6-6z" fill="#101014" />
      <path d="M.5.5h25.3l5.7 5.7v25.3H6.2L.5 25.8z" stroke="#ffffff2e" />
      <path
        d="M7.5 10.5 13 16l-5.5 5.5"
        stroke="#a98bff"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <path
        d="M24.5 10.5 19 16l5.5 5.5"
        stroke="#c8ff2e"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <rect x="15" y="9" width="2" height="14" fill="#f3f3ee" />
    </svg>
  );
}

/** Typographic wordmark: hollow DEV, a lime slash, solid SHOWDOWN. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline display text-[1.375rem] leading-none tracking-[0.02em]",
        className,
      )}
    >
      <span className="text-outline [--outline-color:var(--color-fg)] [-webkit-text-stroke-width:1px]">
        Dev
      </span>
      <span
        aria-hidden="true"
        className="mx-[0.12em] inline-block h-[0.82em] w-[0.14em] -skew-x-[18deg] self-center bg-lime"
      />
      <span className="text-fg">Showdown</span>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <Wordmark />
    </span>
  );
}
