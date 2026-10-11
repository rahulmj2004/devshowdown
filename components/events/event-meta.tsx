import { IndianRupee, Layers, ShieldCheck, Users } from "lucide-react";
import { formatRupees } from "@/lib/utils";
import type { EventConfig } from "@/types";

/**
 * Format, team size and eligibility. Unconfirmed values show as "TBA". The
 * entry fee appears only once the organizers have confirmed one.
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
  ];

  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
      {items.map(({ label, value, Icon }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className="size-3.5 text-subtle" />
          <dt className="text-subtle">{label}</dt>
          <dd className={value ? "text-fg" : "font-mono text-subtle"}>
            {value ?? "TBA"}
          </dd>
        </div>
      ))}
      {event.fee !== null && (
        <div className="flex items-center gap-1.5">
          <IndianRupee aria-hidden="true" className="size-3.5 text-subtle" />
          <dt className="text-subtle">Entry fee</dt>
          <dd className="text-fg">
            {event.fee === 0 ? "Free" : formatRupees(event.fee)}
          </dd>
        </div>
      )}
    </dl>
  );
}
