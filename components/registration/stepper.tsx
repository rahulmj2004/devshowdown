import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  { id: "events", label: "Competition" },
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
  { id: "payment", label: "Payment" },
  { id: "done", label: "Confirmation" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/** Progress through the registration steps. Informational, not navigation. */
export function Stepper({
  current,
  skipPayment,
}: {
  current: StepId;
  /** Nothing is payable, so the payment step will not be visited. */
  skipPayment: boolean;
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol
      aria-label="Registration progress"
      className="grid grid-cols-5 gap-1.5 sm:gap-2"
    >
      {STEPS.map((step, index) => {
        const skipped = step.id === "payment" && skipPayment;
        const done = index < currentIndex && !skipped;
        const active = index === currentIndex;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className="min-w-0"
          >
            <span
              aria-hidden="true"
              className="block h-0.5 w-full overflow-hidden bg-line-strong"
            >
              <span
                className={cn(
                  "block h-full origin-left bg-lime transition-transform duration-500 ease-out",
                  done || active ? "scale-x-100" : "scale-x-0",
                )}
              />
            </span>
            <span className="mt-2.5 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center font-mono text-[10px] transition-colors duration-300",
                  done && "bg-lime text-[#060608]",
                  active && "border border-lime text-lime",
                  !done && !active && "border border-line-strong text-subtle",
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden truncate eyebrow sm:block",
                  active ? "text-fg" : "text-subtle",
                  skipped && "line-through decoration-subtle/60",
                )}
              >
                {step.label}
              </span>
              <span className="sr-only sm:hidden">{step.label}</span>
              {done && <span className="sr-only"> (completed)</span>}
              {skipped && <span className="sr-only"> (not needed)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
