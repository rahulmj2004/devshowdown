import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { EventLifecycle } from "@/types";

const lifecycle: Record<EventLifecycle, { label: string; tone: BadgeTone }> = {
  upcoming: { label: "Upcoming", tone: "violet" },
  live: { label: "Live now", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
};

export function EventStatusBadge({ status }: { status: EventLifecycle }) {
  const { label, tone } = lifecycle[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
