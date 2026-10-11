import { IndianRupee, Layers, ShieldCheck, Users } from "lucide-react";
import { formatRupees } from "@/lib/utils";
import type { EventConfig } from "@/types";

/**
 * Format, team size and eligibility as a ruled spec sheet. Unconfirmed values
 * show as "TBA". The entry fee appears only once the organizers have
 * confirmed one.
 */
export function EventMeta({
  event,
}: {
  event: Pick<EventConfig, "format" | "teamSize" | "eligibility" | "fee">;
}) {
  const items = [
    { label: "Format", value: event.format, Icon: Layers },
    { label: "Team size", value: event.teamSize, Icon: Users },
    { label: "Eligibility", value: event.eligibility, Icon: ShieldCheck },
    ...(event.fee === null
      ? []
      : [
          {
            label: "Entry fee",
            value: event.fee === 0 ? "Free" : formatRupees(event.fee),
            Icon: IndianRupee,
          },
        ]),
  ];

  return (
    <dl className="grid gap-px border border-line bg-line sm:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">
      {items.map(({ label, value, Icon }) => (
        <div key={label} className="bg-surface px-4 py-3.5">
          <dt className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">
            <Icon aria-hidden="true" className="size-3 text-(--accent)" />
            {label}
          </dt>
          <dd
            className={
              value
                ? "mt-1.5 text-sm leading-snug text-fg"
                : "mt-1.5 font-mono text-sm text-subtle/70"
            }
          >
            {value ?? "TBA"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
