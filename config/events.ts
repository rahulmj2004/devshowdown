import type { EventConfig, RankingRule } from "@/types";

/**
 * Leaderboard ordering used until an event's scoring is confirmed.
 * This only controls how published rows are sorted and labelled; it is not a
 * statement of the competition's scoring policy (see `scoring` on each event).
 */
export const defaultRanking: RankingRule = {
  scoreLabel: "Score",
  scoreOrder: "desc",
  timeTiebreak: true,
  showTime: true,
};

/**
 * Central event configuration.
 *
 * To add a competition, append an object here. Cards, detail pages, the
 * registration flow, the leaderboard filter, the sitemap and the hero terminal
 * all read from this list, so nothing else needs to change.
 *
 * ORGANIZER INPUT NEEDED: every `null` below. The UI shows them as
 * "Awaiting confirmation" / "TBA" instead of inventing a value.
 *   duration, format, teamSize, eligibility  display text
 *   team   { min, max } members incl. the registrant; drives the form
 *   fee    whole rupees per entry; null = no fee confirmed, nothing charged
 *   rules, scoring, tools                    lists of strings
 *
 * Slugs are stored with registrations and results, so do not rename them once
 * registration has opened.
 */
export const events: EventConfig[] = [
  {
    slug: "code-debugging",
    title: "Debugging",
    tagline: "Find the bug. Fix the chaos.",
    category: "Debugging",
    summary:
      "Find the hidden bugs, repair broken logic, and prove your debugging skills.",
    overview: [
      "You are handed code that does not work. Your job is to find out why and fix it.",
      "Expect hidden bugs and broken logic. Reading carefully and reasoning about what the code actually does matters more than typing fast.",
    ],
    icon: "bug",
    visual: "debug",
    accent: "rose",
    status: "upcoming",
    registrationEnabled: true,
    duration: null,
    format: null,
    teamSize: null,
    team: null,
    fee: null,
    eligibility: null,
    rules: null,
    scoring: null,
    tools: null,
    ranking: defaultRanking,
  },
  {
    slug: "blind-coding",
    title: "Blind Coding",
    tagline: "No peeking. Pure instinct.",
    category: "Instinct",
    summary:
      "Write code you cannot see. Trust your fundamentals and your muscle memory.",
    overview: [
      "You write code without being able to see what you are typing.",
      "With no screen to lean on, what counts is how well you know the language and how clearly you can hold a solution in your head.",
    ],
    icon: "eye-off",
    visual: "blind",
    accent: "violet",
    status: "upcoming",
    registrationEnabled: true,
    duration: null,
    format: null,
    teamSize: null,
    team: null,
    fee: null,
    eligibility: null,
    rules: null,
    scoring: null,
    tools: null,
    ranking: defaultRanking,
  },
  {
    slug: "tech-treasure-hunt",
    title: "Treasure Hunt",
    tagline: "Follow the clues. Unlock the unknown.",
    category: "Puzzle",
    summary: "Crack clues, solve puzzles, and follow the trail to victory.",
    overview: [
      "A trail of clues and puzzles with a tech twist. Each one you crack points to the next.",
      "Sharp observation and lateral thinking will carry you to the end of the trail.",
    ],
    icon: "compass",
    visual: "hunt",
    accent: "lime",
    status: "upcoming",
    registrationEnabled: true,
    duration: null,
    format: null,
    teamSize: null,
    team: null,
    fee: null,
    eligibility: null,
    rules: null,
    scoring: null,
    tools: null,
    ranking: defaultRanking,
  },
  {
    slug: "speed-typing",
    title: "Speed Typing",
    tagline: "Fingers faster than thought.",
    category: "Speed",
    summary: "Test your typing speed, precision, and composure under pressure.",
    overview: [
      "A head-to-head test of how quickly and accurately you can type when the clock is running.",
      "Raw speed only gets you so far. Staying accurate and calm while the pressure builds is what separates the top of the board.",
    ],
    icon: "keyboard",
    visual: "typing",
    accent: "cyan",
    status: "upcoming",
    registrationEnabled: true,
    duration: null,
    format: null,
    teamSize: null,
    team: null,
    fee: null,
    eligibility: null,
    rules: null,
    scoring: null,
    tools: null,
    ranking: defaultRanking,
  },
  {
    slug: "coding-challenge",
    title: "Coding",
    tagline: "Turn ideas into impact.",
    category: "Programming",
    summary:
      "Solve programming problems with logic, efficiency, and clean solutions.",
    overview: [
      "A set of programming problems to solve from scratch.",
      "Strong entries combine sound logic with efficient, clean solutions.",
    ],
    icon: "braces",
    visual: "code",
    accent: "violet",
    status: "upcoming",
    registrationEnabled: true,
    duration: null,
    format: null,
    teamSize: null,
    team: null,
    fee: null,
    eligibility: null,
    rules: null,
    scoring: null,
    tools: null,
    ranking: defaultRanking,
  },
];

export function getEvents(): EventConfig[] {
  return events;
}

export function getEventBySlug(slug: string): EventConfig | undefined {
  return events.find((event) => event.slug === slug);
}

export function getEventSlugs(): string[] {
  return events.map((event) => event.slug);
}
