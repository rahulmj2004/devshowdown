import type { EventConfig, RegistrationStatus } from "@/types";

type RegistrableEvent = Pick<EventConfig, "status" | "registrationEnabled">;

/**
 * An event accepts registrations only when the site-wide switch is open, the
 * event has not started, and the organizer has not disabled it individually.
 */
export function isEventRegistrationOpen(
  event: RegistrableEvent,
  siteStatus: RegistrationStatus,
): boolean {
  return (
    siteStatus === "open" &&
    event.registrationEnabled &&
    event.status === "upcoming"
  );
}

/** Short, truthful label for an event's registration state. */
export function getRegistrationLabel(
  event: RegistrableEvent,
  siteStatus: RegistrationStatus,
): string {
  if (isEventRegistrationOpen(event, siteStatus)) return "Registration open";
  if (siteStatus === "not_open" && event.status === "upcoming") {
    return "Registration not open yet";
  }
  return "Registration closed";
}
