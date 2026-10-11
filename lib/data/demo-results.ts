import type { ResultEntry } from "@/types";

/**
 * Demonstration rows for previewing the leaderboard layout. These are not real
 * participants or results, and every surface that renders them says so.
 */
export const demoResults: ResultEntry[] = [
  {
    id: "demo-1",
    eventSlug: "speed-typing",
    displayName: "Demo Player A",
    score: 96,
    completionTimeMs: 61_240,
  },
  {
    id: "demo-2",
    eventSlug: "speed-typing",
    displayName: "Demo Player B",
    score: 91,
    completionTimeMs: 63_905,
  },
  {
    id: "demo-3",
    eventSlug: "speed-typing",
    displayName: "Demo Player C",
    score: 84,
    completionTimeMs: 66_480,
  },
  {
    id: "demo-4",
    eventSlug: "code-debugging",
    displayName: "Demo Player D",
    score: 80,
    completionTimeMs: 1_122_000,
  },
  {
    id: "demo-5",
    eventSlug: "code-debugging",
    displayName: "Demo Player A",
    score: 80,
    completionTimeMs: 1_305_500,
  },
  {
    id: "demo-6",
    eventSlug: "code-debugging",
    displayName: "Demo Player E",
    score: 60,
    completionTimeMs: 1_490_250,
  },
  {
    id: "demo-13",
    eventSlug: "blind-coding",
    displayName: "Demo Player F",
    score: 90,
    completionTimeMs: 1_410_000,
  },
  {
    id: "demo-14",
    eventSlug: "blind-coding",
    displayName: "Demo Player D",
    score: 75,
    completionTimeMs: 1_520_400,
  },
  {
    id: "demo-15",
    eventSlug: "blind-coding",
    displayName: "Demo Player B",
    score: 75,
    completionTimeMs: 1_688_900,
  },
  {
    id: "demo-7",
    eventSlug: "coding-challenge",
    displayName: "Demo Player C",
    score: 300,
    completionTimeMs: 2_704_000,
  },
  {
    id: "demo-8",
    eventSlug: "coding-challenge",
    displayName: "Demo Player F",
    score: 250,
    completionTimeMs: 2_950_750,
  },
  {
    id: "demo-9",
    eventSlug: "coding-challenge",
    displayName: "Demo Player B",
    score: 200,
    completionTimeMs: 3_120_000,
  },
  {
    id: "demo-10",
    eventSlug: "tech-treasure-hunt",
    displayName: "Demo Team One",
    score: 8,
    completionTimeMs: 1_845_000,
  },
  {
    id: "demo-11",
    eventSlug: "tech-treasure-hunt",
    displayName: "Demo Team Two",
    score: 8,
    completionTimeMs: 2_010_300,
  },
  {
    id: "demo-12",
    eventSlug: "tech-treasure-hunt",
    displayName: "Demo Team Three",
    score: 6,
    completionTimeMs: 2_233_900,
  },
];
