import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClasses =
  "h-11 w-full min-w-0 rounded-[3px] border border-line-strong bg-bg px-3.5 text-sm text-fg placeholder:text-subtle/70 transition-colors hover:border-white/40 focus-visible:border-lime focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-lime/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";

/** Label, optional hint, control and inline error, wired up for a11y. */
export function Field({
  id,
  label,
  optional = false,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-subtle">(optional)</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** `aria-describedby` / `aria-invalid` props for a control inside <Field>. */
export function describe(id: string, error?: string, hint?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}
