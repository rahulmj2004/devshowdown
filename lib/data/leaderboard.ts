import { getEvents } from "@/config/events";
import { rankEntries } from "@/lib/scoring";
import type { EventConfig, RankedEntry, ResultEntry } from "@/types";

export interface LeaderboardGroup {
  event: EventConfig;
  rows: RankedEntry[];
}

/**
 * Groups entries by event and ranks each group with that event's own rule.
 * Scores are never compared across competitions.
 */
export function buildLeaderboard(
  entries: readonly ResultEntry[],
  eventSlug?: string,
): LeaderboardGroup[] {
  return getEvents()
    .filter((event) => !eventSlug || event.slug === eventSlug)
    .map((event) => ({
      event,
      rows: rankEntries(
        entries.filter((entry) => entry.eventSlug === event.slug),
        event.ranking,
      ),
    }))
    .filter((group) => group.rows.length > 0);
}
