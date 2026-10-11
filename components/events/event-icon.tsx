import { Braces, Bug, Compass, EyeOff, Keyboard, Puzzle } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { EventIconKey } from "@/types";

/** Maps the serialisable icon key from the event config to a component. */
const icons: Record<EventIconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  keyboard: Keyboard,
  bug: Bug,
  braces: Braces,
  compass: Compass,
  puzzle: Puzzle,
  "eye-off": EyeOff,
};

export function EventIcon({
  icon,
  className,
}: {
  icon: EventIconKey;
  className?: string;
}) {
  const Icon = icons[icon];
  return <Icon aria-hidden="true" className={className} />;
}
