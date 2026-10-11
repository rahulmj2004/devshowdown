import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

/*
 * The notched fill lives on ::before so the element itself is never clipped
 * and its focus outline stays fully visible.
 */
const base =
  "relative isolate inline-flex items-center justify-center gap-2 font-mono font-medium uppercase tracking-[0.08em] whitespace-nowrap transition-[color,border-color,transform] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary:
    "text-[#060608] before:absolute before:inset-0 before:-z-10 before:notch before:bg-lime before:transition-colors before:duration-200 hover:before:bg-white",
  secondary:
    "rounded-[3px] border border-line-strong bg-white/[0.03] text-fg hover:border-lime hover:text-lime",
  ghost: "rounded-[3px] text-muted hover:bg-white/[0.06] hover:text-fg",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-11 px-5 text-xs",
  lg: "h-13 px-7 text-[13px]",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: StyleProps = {}): string {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: StyleProps & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: StyleProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props} />
  );
}
