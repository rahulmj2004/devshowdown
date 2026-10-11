import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import type { ResultEntry } from "@/types";
import { CACHE_TAGS } from "./tags";

const resultRowSchema = z.object({
  id: z.string(),
  event_slug: z.string(),
  display_name: z.string(),
  score: z.coerce.number(),
  completion_time_ms: z.number().nullable(),
});

export type ResultsSource =
  /** Supabase is not connected, so there is nowhere to read results from. */
  | "not_configured"
  | "database"
  /** The backend is connected but the read failed. */
  | "error";

export interface PublishedResults {
  entries: ResultEntry[];
  source: ResultsSource;
}

/**
 * Published leaderboard rows. Only display names and scores are selected, and
 * RLS exposes published rows only, so no participant contact data can leak.
 */
export async function getPublishedResults(): Promise<PublishedResults> {
  "use cache";
  cacheTag(CACHE_TAGS.results);
  cacheLife("minutes");

  const supabase = createPublicClient();
  if (!supabase) return { entries: [], source: "not_configured" };

  try {
    const { data, error } = await supabase
      .from("results")
      .select("id, event_slug, display_name, score, completion_time_ms")
      .eq("published", true)
      .limit(1000);
    if (error) return { entries: [], source: "error" };

    const entries = z
      .array(resultRowSchema)
      .parse(data ?? [])
      .map((row) => ({
        id: row.id,
        eventSlug: row.event_slug,
        displayName: row.display_name,
        score: row.score,
        completionTimeMs: row.completion_time_ms,
      }));
    return { entries, source: "database" };
  } catch {
    return { entries: [], source: "error" };
  }
}
