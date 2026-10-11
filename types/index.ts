/**
 * Shared domain types. Presentation components, validation, scoring and the
 * data layer all build on these, so keep them free of framework imports.
 */

/** Where an event is in its life. Organizer-controlled via config. */
export type EventLifecycle = "upcoming" | "live" | "completed";

/** Site-wide registration switch. Defaults to "not_open" until configured. */
export type RegistrationStatus = "not_open" | "open" | "closed";

export type EventIconKey =
  "keyboard" | "bug" | "braces" | "compass" | "puzzle" | "eye-off";
export type EventVisualKind =
  "typing" | "debug" | "blind" | "code" | "hunt" | "generic";
export type Accent = "violet" | "cyan" | "lime" | "rose";

/**
 * Team rule that drives the registration form. `min`/`max` count every member
 * including the person registering, so `{ min: 1, max: 1 }` is a solo event.
 */
export interface TeamRule {
  min: number;
  max: number;
}

/** How leaderboard rows for one event are ordered and displayed. */
export interface RankingRule {
  /** Column heading for the score, e.g. "Score", "WPM", "Points". */
  scoreLabel: string;
  /** "desc" = higher score wins, "asc" = lower score wins. */
  scoreOrder: "desc" | "asc";
  /** Break score ties with the faster completion time. */
  timeTiebreak: boolean;
  /** Show the completion-time column for this event. */
  showTime: boolean;
}

/**
 * One competition. Every field typed `| null` is an organizer decision that
 * may not be confirmed yet; `null` renders as "Awaiting confirmation" and is
 * never replaced with a guess.
 */
export interface EventConfig {
  slug: string;
  title: string;
  category: string;
  /** Short uppercase line shown on the arena card and details page. */
  tagline: string;
  /** One-line description used on cards. */
  summary: string;
  /** Longer overview paragraphs for the details page. */
  overview: string[];
  icon: EventIconKey;
  visual: EventVisualKind;
  accent: Accent;
  status: EventLifecycle;
  /** Set false to keep one event closed while site registration is open. */
  registrationEnabled: boolean;
  duration: string | null;
  format: string | null;
  teamSize: string | null;
  /**
   * Machine-readable team rule for the registration form. While `null`, the
   * form only offers an optional team name and collects no member details.
   */
  team: TeamRule | null;
  /**
   * Registration fee in whole rupees. `null` means the organizers have not
   * confirmed a fee: nothing is displayed as a price and nothing is charged.
   */
  fee: number | null;
  eligibility: string | null;
  rules: string[] | null;
  scoring: string[] | null;
  tools: string[] | null;
  ranking: RankingRule;
}

export interface PrizeTier {
  label: string;
  amount: number;
  note?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  /** Marks answers that depend on details the organizer has not confirmed. */
  awaitingConfirmation?: boolean;
}

export interface SocialLink {
  label: string;
  href: string;
}

/** Settings that can change at runtime (database-backed when configured). */
export interface SiteSettings {
  registrationStatus: RegistrationStatus;
  announcementLabel: string;
  announcementText: string;
  /** Where the values came from, so the UI can be honest about it. */
  source: "config" | "database";
}

/** A published result. Contains display names only, never contact details. */
export interface ResultEntry {
  id: string;
  eventSlug: string;
  displayName: string;
  score: number;
  completionTimeMs: number | null;
}

export interface RankedEntry extends ResultEntry {
  rank: number;
}

export interface ScheduleItem {
  /** Free text, already in the event's local timezone, e.g. "10:00 AM". */
  time: string;
  title: string;
  description?: string;
  kind?: "registration" | "ceremony" | "round" | "break" | "results";
}

export interface ScheduleDay {
  /** e.g. "Day 1 · Saturday 14 March". */
  label: string;
  items: ScheduleItem[];
}

export interface Sponsor {
  name: string;
  /** Path under /public or an absolute URL to the logo. */
  logo?: string;
  href?: string;
}

export interface SponsorTier {
  tier: string;
  sponsors: Sponsor[];
}

/** Lifecycle of one registration (a participant's entry for 1+ events). */
export type RegistrationState = "pending_payment" | "confirmed" | "superseded";

/**
 * Payment states shown to participants.
 *  - not_required          nothing is payable online
 *  - pending               an amount is due and has not been verified as paid
 *  - paid                  verified on the server (signature + gateway status)
 *  - failed                the last attempt failed; a retry is allowed
 *  - verification_required money may have moved but the server could not
 *                          match it cleanly; organizers must review it
 */
export type PaymentState =
  "not_required" | "pending" | "paid" | "failed" | "verification_required";

/** How payments are handled by this deployment. Derived on the server. */
export type PaymentMode = "razorpay" | "mock" | "unconfigured";

/** Private participant record. Only ever read on the server by organizers. */
export interface RegistrationRecord {
  id: string;
  reference: string;
  status: RegistrationState;
  paymentStatus: PaymentState;
  /** Settled through the mock gateway: not real money. */
  testPayment: boolean;
  fullName: string;
  email: string;
  organization: string;
  eventSlug: string;
  teamName: string | null;
  /** Team members other than the registrant. */
  teamMembers: string[];
  phone: string | null;
  createdAt: string;
}

export type PhoneFieldMode = "hidden" | "optional" | "required";
