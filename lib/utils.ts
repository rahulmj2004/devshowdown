import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

/** Formats a rupee amount with Indian digit grouping, e.g. 15000 -> "₹15,000". */
export function formatRupees(amount: number): string {
  return `₹${rupeeFormatter.format(amount)}`;
}

const paiseFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats an amount held in paise, e.g. 15000 -> "₹150", 15050 -> "₹150.5". */
export function formatPaise(paise: number): string {
  return paiseFormatter.format(paise / 100);
}

export function formatNumber(value: number): string {
  return rupeeFormatter.format(value);
}

/** Builds a `tel:` link from a display number, e.g. "+91 98765 43210". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
