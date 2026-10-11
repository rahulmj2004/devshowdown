import type { RankedEntry, RankingRule, ResultEntry } from "@/types";

function compareEntries(
  a: ResultEntry,
  b: ResultEntry,
  rule: RankingRule,
): number {
  if (a.score !== b.score) {
    return rule.scoreOrder === "desc" ? b.score - a.score : a.score - b.score;
  }
  if (rule.timeTiebreak) {
    // A recorded time always beats a missing one.
    const aTime = a.completionTimeMs ?? Number.POSITIVE_INFINITY;
    const bTime = b.completionTimeMs ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
  }
  return 0;
}

/**
 * Ranks one event's entries using standard competition ranking: entries that
 * are genuinely tied share a rank and the next rank is skipped (1, 2, 2, 4).
 */
export function rankEntries(
  entries: readonly ResultEntry[],
  rule: RankingRule,
): RankedEntry[] {
  const sorted = [...entries].sort(
    (a, b) =>
      compareEntries(a, b, rule) || a.displayName.localeCompare(b.displayName),
  );

  const ranked: RankedEntry[] = [];
  sorted.forEach((entry, index) => {
    const previous = ranked[index - 1];
    const tied = previous && compareEntries(previous, entry, rule) === 0;
    ranked.push({ ...entry, rank: tied ? previous.rank : index + 1 });
  });
  return ranked;
}

/** Formats a completion time in milliseconds as m:ss.mmm or h:mm:ss. */
export function formatCompletionTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}.${pad(Math.floor(ms % 1000), 3)}`;
}

export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}
