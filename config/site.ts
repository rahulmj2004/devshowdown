import type {
  FaqItem,
  PhoneFieldMode,
  PrizeTier,
  RegistrationStatus,
  ScheduleDay,
  SocialLink,
  SponsorTier,
} from "@/types";

/**
 * Organizer-editable site configuration. Competitions live in `events.ts`.
 *
 * ORGANIZER INPUT NEEDED: anything set to `null` (or an empty list) has not
 * been confirmed. It is rendered as a clearly labelled placeholder and is
 * never replaced with a guess. Fill a value in here and the whole site picks
 * it up.
 */
export const siteConfig = {
  name: "DevShowdown",
  tagline: "Enter the arena. Prove your skills.",
  /** Three beats shown under the hero wordmark. */
  headline: ["Code.", "Compete.", "Conquer."],
  description:
    "DevShowdown is a developer competition where you compete through speed, logic, coding, and problem-solving.",
  heroCopy:
    "Five competitions, one arena. Debug, type, hunt and code your way up the board.",

  about: [
    "DevShowdown brings developers together for a set of focused competitions: typing against the clock, hunting down bugs, coding without seeing the screen, solving programming problems, and cracking a trail of technical clues.",
    "Pick the challenge that suits you, or the one that scares you a little. The full schedule will be announced by the organizers.",
  ],

  /** What the competitions are built to test. Shown in the About section. */
  skills: [
    {
      title: "Problem-solving",
      text: "Every competition is a puzzle at heart. Break the problem down and reason your way through it.",
    },
    {
      title: "Speed",
      text: "The clock is part of the challenge. Quick thinking and quick hands both count.",
    },
    {
      title: "Creativity",
      text: "There is rarely only one way to solve a problem. Unusual approaches are welcome.",
    },
    {
      title: "Programming ability",
      text: "Put what you practise to work: reading code, writing code, and fixing code.",
    },
    {
      title: "Friendly competition",
      text: "Compete hard, learn from the people around you, and enjoy it.",
    },
  ],

  /** Core event facts. All unconfirmed. */
  details: {
    /** Display text, e.g. "14–15 March 2027". */
    dates: null as string | null,
    venue: null as string | null,
    registrationDeadline: null as string | null,
    organizer: null as string | null,
    /**
     * Start of the event as an ISO 8601 instant with an offset, e.g.
     * "2027-03-14T09:30:00+05:30". Powers the hero countdown.
     */
    startsAt: null as string | null,
    /** IANA timezone that every displayed time is in. */
    timezone: "Asia/Kolkata",
    timezoneLabel: "IST",
  },

  prize: {
    /** Total prize pool in rupees. */
    total: 15000,
    /**
     * ORGANIZER: set to `false` once ₹15,000 is confirmed as the final amount
     * for this edition. While `true` the figure is labelled as approximate and
     * awaiting confirmation everywhere it appears.
     */
    approximate: true,
    /**
     * Podium split, e.g.
     *   [{ label: "1st place", amount: 7500 }, { label: "2nd place", ... }]
     * The first three tiers are drawn as the podium.
     */
    distribution: null as PrizeTier[] | null,
    distributionNote:
      "How the prize pool is split across competitions and places will be announced by the organizers.",
    /** Prize eligibility rules, once the organizers publish them. */
    eligibility: null as string[] | null,
  },

  /**
   * Day-by-day programme. Leave empty until times are confirmed; add entries
   * like:
   *   { label: "Day 1 · Saturday 14 March", items: [
   *       { time: "09:00 AM", title: "Check-in", kind: "registration" },
   *   ] }
   */
  schedule: [] as ScheduleDay[],

  /** Sponsor wall. Add tiers once partners are confirmed; never add fakes. */
  sponsors: [] as SponsorTier[],

  /**
   * Fallback runtime settings, used when the database is not connected.
   * With Supabase configured, organizers change these from the admin dashboard.
   */
  defaults: {
    registrationStatus: "not_open" as RegistrationStatus,
    announcementLabel: "Announced",
    announcementText: "Dates, venue and registration details coming soon",
  },

  registration: {
    /** "hidden" | "optional" | "required" */
    phoneField: "optional" as PhoneFieldMode,
    /**
     * ORGANIZER: confirm whether one participant may enter several
     * competitions. `false` limits each registration to a single event.
     */
    allowMultipleEvents: true,
  },

  /**
   * Whether payments are live is decided by server environment variables, not
   * here (see `lib/payments/config.ts` and the README). This only holds copy.
   */
  payment: {
    currency: "INR",
    /** Shown on the confirmation screen once a refund policy is published. */
    refundPolicy: null as string | null,
  },

  contact: {
    email: null as string | null,
    phone: null as string | null,
  },

  /** Add `{ label, href }` entries once official accounts exist. */
  socials: [] as SocialLink[],

  nav: [
    { label: "Home", href: "/", section: "top" },
    { label: "Events", href: "/#events", section: "events" },
    { label: "Prizes", href: "/#prizes", section: "prizes" },
    { label: "Schedule", href: "/#schedule", section: "schedule" },
    { label: "About", href: "/#about", section: "about" },
    { label: "FAQ", href: "/#faq", section: "faq" },
  ],
} as const satisfies Record<string, unknown>;

export const faqs: FaqItem[] = [
  {
    question: "What is DevShowdown?",
    answer:
      "DevShowdown is a developer competition made up of several events that test speed, logic, coding, and problem-solving. The total prize pool is approximately ₹15,000.",
  },
  {
    question: "Which competitions can I take part in?",
    answer:
      "Five competitions have been announced: Debugging, Blind Coding, Treasure Hunt, Speed Typing, and Coding.",
  },
  {
    question: "When and where does it take place?",
    answer:
      "The dates and venue have not been announced yet. This page will be updated as soon as the organizers confirm them.",
    awaitingConfirmation: true,
  },
  {
    question: "Who can participate?",
    answer:
      "Eligibility requirements have not been published yet. Check each event page for updates.",
    awaitingConfirmation: true,
  },
  {
    question: "How do I register?",
    answer:
      "Registration happens on this site: choose your competitions, enter your details, review, and confirm. The registration page always shows the current status, and accepts entries once the organizers open it.",
  },
  {
    question: "Can I enter more than one competition?",
    answer:
      "The policy on entering multiple competitions has not been confirmed yet. The registration page shows what is currently allowed.",
    awaitingConfirmation: true,
  },
  {
    question: "Do I register alone or as a team?",
    answer:
      "Team sizes have not been confirmed yet. Each event page will show whether it is a solo or team event.",
    awaitingConfirmation: true,
  },
  {
    question: "Is there a registration fee, and how do I pay?",
    answer:
      "Fee details have not been confirmed yet. If a fee applies, it is shown on the event page and in the review step before you pay, and payment is taken through a secure checkout. This site never sees or stores your card details.",
    awaitingConfirmation: true,
  },
  {
    question: "What is the refund policy?",
    answer: "A refund policy has not been published yet.",
    awaitingConfirmation: true,
  },
  {
    question: "Will I get a certificate?",
    answer:
      "Whether certificates are issued has not been confirmed by the organizers yet.",
    awaitingConfirmation: true,
  },
  {
    question: "How will the prize pool be distributed?",
    answer:
      "The total prize pool is approximately ₹15,000. How it is split across competitions and places will be announced later.",
    awaitingConfirmation: true,
  },
  {
    question: "Who do I contact with a question?",
    answer:
      "Organizer contact details have not been published yet. They will appear in the footer of this site.",
    awaitingConfirmation: true,
  },
];

export const registrationStatusCopy: Record<
  RegistrationStatus,
  { label: string; description: string }
> = {
  not_open: {
    label: "Registration not open yet",
    description:
      "Registration has not opened yet. Check back once the organizers announce it.",
  },
  open: {
    label: "Registration open",
    description: "Registration is open. Pick your competitions and sign up.",
  },
  closed: {
    label: "Registration closed",
    description: "Registration is closed for this edition.",
  },
};
