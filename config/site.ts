import type {
  Coordinator,
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
    "Five rounds, one arena. Debug, type, hunt and code your way up the board.",

  about: [
    "DevShowdown brings developers together for a set of focused competitions: typing against the clock, hunting down bugs, coding without seeing the screen, solving programming problems, and cracking a trail of technical clues.",
    "Teams of three register once. Each member takes one morning sub-event, and the top teams go on to the Treasure Hunt and the Coding round.",
  ],

  /**
   * General rules, shown on the Rules page. `null` until they are published.
   */
  rules: [
    "Each team must have exactly 3 members.",
    "There are 3 sub-events in the morning: Debugging, Speed Typing and Blind Coding.",
    "Each team member must take part in one sub-event.",
    "The registration fee is ₹150 per team.",
    "Every participant must bring their college ID card.",
    "The 5 teams with the highest combined individual points advance to the next phase: the Treasure Hunt and the Coding round.",
    "The top 2 teams in the afternoon Treasure Hunt are awarded the prize money.",
  ] as string[] | null,

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

  /** Core event facts. Anything still `null` is unconfirmed. */
  details: {
    /** Display text, e.g. "14–15 March 2027". */
    dates: "15 October 2026" as string | null,
    venue: "Vidya Academy of Science and Technology, Thrissur" as string | null,
    venueAddress:
      "P.O. Thalakottukara, Kaipparambu, Thrissur, Kerala 680601" as
        string | null,
    /** Opens directions to the venue in Google Maps. */
    venueMapUrl:
      "https://www.google.com/maps?client=safari&rls=en&oe=UTF-8&um=1&ie=UTF-8&fb=1&gl=in&sa=X&geocode=KQdGWA5N6qc7MS4krx3-52Qm&daddr=P.O.+Thalakottukara,,+Kaipparambu,+Thrissur,+Keralam+680601" as
        string | null,
    /** Keyless Google Maps embed shown in the About section. */
    venueMapEmbedUrl:
      "https://www.google.com/maps?q=Vidya+Academy+of+Science+and+Technology,+Thalakottukara,+Thrissur,+Kerala+680601&z=15&output=embed" as
        string | null,
    registrationDeadline: "14 October 2026" as string | null,
    organizer: "Department of Computer Science and Engineering" as
      string | null,
    /**
     * Start of the event as an ISO 8601 instant with an offset, e.g.
     * "2027-03-14T09:30:00+05:30". Powers the hero countdown.
     */
    startsAt: "2026-10-15T00:00:00+05:30" as string | null,
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
    /** The road to the prize, drawn while `distribution` is not set. */
    stages: [
      {
        when: "Morning",
        who: "All teams",
        text: "Debugging, Speed Typing and Blind Coding. One member per sub-event.",
      },
      {
        when: "Afternoon",
        who: "Top 5 teams",
        text: "The highest combined points advance to the Treasure Hunt and the Coding round.",
      },
      {
        when: "Finish",
        who: "Top 2 teams",
        text: "Win the prize money. Winners receive certificates.",
      },
    ],
    distributionNote:
      "The prize money goes to the top 2 teams in the afternoon Treasure Hunt. The amount for each place will be announced by the organizers.",
    /** Prize eligibility rules, once the organizers publish them. */
    eligibility: [
      "The 5 teams with the highest combined individual points from the morning sub-events advance to the afternoon rounds.",
      "The top 2 teams in the Treasure Hunt are awarded the prize money.",
      "Winners receive certificates.",
    ] as string[] | null,
  },

  /**
   * Day-by-day programme. Leave empty until times are confirmed; add entries
   * like:
   *   { label: "Day 1 · Saturday 14 March", items: [
   *       { time: "09:00 AM", title: "Check-in", kind: "registration" },
   *   ] }
   */
  schedule: [
    {
      label: "Morning session",
      items: [
        { time: "Sub-event", title: "Debugging", kind: "round" },
        { time: "Sub-event", title: "Speed Typing", kind: "round" },
        {
          time: "Sub-event",
          title: "Blind Coding",
          kind: "round",
          description:
            "Each team member takes part in one of the three morning sub-events. The 5 teams with the highest combined points advance.",
        },
      ],
    },
    {
      label: "Afternoon session",
      items: [
        {
          time: "Top 5 teams",
          title: "Treasure Hunt",
          kind: "round",
          description: "The top 2 teams here are awarded the prize money.",
        },
        { time: "Afternoon round", title: "Coding round", kind: "round" },
      ],
    },
  ] as ScheduleDay[],

  /**
   * Sponsor wall. There are no sponsors, so `SponsorsSection` is not on the
   * home page; add tiers here and put it back in `app/page.tsx` if that changes.
   */
  sponsors: [] as SponsorTier[],

  /**
   * Fallback runtime settings, used when the database is not connected.
   * With Supabase configured, organizers change these from the admin dashboard.
   */
  defaults: {
    registrationStatus: "open" as RegistrationStatus,
    announcementLabel: "Announced",
    announcementText:
      "15 October 2026 · Vidya Academy of Science and Technology, Thrissur",
  },

  registration: {
    /** Members in every team, including the person who registers. */
    teamSize: 3 as number | null,
    /** Entry fee per team in whole rupees, covering the whole event. */
    teamFee: 150 as number | null,
    /**
     * External form (Google Form) that takes registrations and payment. While
     * this is set, the Register page links to it instead of showing the
     * built-in registration form. Set to `null` to use the built-in form.
     */
    formUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSeaYDkltDLEUTFFrbZAJkb9tFHooOa97dNe-7sYfpe6uuHcPg/viewform" as
        string | null,
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
    /**
     * Direct UPI payment. Set BOTH to switch it on: participants then pay this
     * UPI ID from a QR code, enter their transaction ID, and an organizer
     * approves it from the dashboard. Razorpay keys, if set, take priority.
     *   vpa: "yourname@okhdfcbank", payeeName: "Rahul M J"
     */
    upi: {
      vpa: null as string | null,
      payeeName: null as string | null,
    },
  },

  contact: {
    email: null as string | null,
    /** Single number shown on the registration confirmation screen. */
    phone: "+91 81568 97436" as string | null,
  },

  /**
   * Event coordinators, in display order. Photos live in
   * `public/coordinators/` as 4:5 portraits.
   */
  coordinators: [
    {
      name: "Rahul M J",
      role: "Coordinator",
      phone: "+91 81568 97436",
      photo: "/coordinators/rahul-m-j.jpg",
    },
    {
      name: "Advaith U",
      role: "Coordinator",
      phone: "+91 92073 30859",
      photo: "/coordinators/advaith-u.jpg",
    },
    {
      name: "Devinandha VR",
      role: "Coordinator",
      phone: "+91 80894 05787",
      photo: "/coordinators/devinandha-vr.jpg",
    },
  ] as Coordinator[],

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
      "Three sub-events in the morning (Debugging, Speed Typing and Blind Coding), followed by the Treasure Hunt and the Coding round. Your team registers once for the whole event.",
  },
  {
    question: "When and where does it take place?",
    answer:
      "DevShowdown takes place on 15 October 2026 at Vidya Academy of Science and Technology, P.O. Thalakottukara, Kaipparambu, Thrissur, Kerala 680601. A map and directions are in the About section.",
  },
  {
    question: "Who can participate?",
    answer:
      "Teams of 3 members. Every participant must bring their college ID card on the day. Any further eligibility requirements have not been published yet.",
    awaitingConfirmation: true,
  },
  {
    question: "How do I register?",
    answer:
      "Open the Register page and follow the link to the registration form. Fill in your details, complete the payment as the form explains, and submit it.",
  },
  {
    question: "Can I enter more than one competition?",
    answer:
      "There is only one registration, for your team. In the morning there are 3 sub-events (Debugging, Speed Typing and Blind Coding) and each team member takes part in one of them. The top 5 teams then go on to the Treasure Hunt and the Coding round.",
  },
  {
    question: "Do I register alone or as a team?",
    answer: "As a team. Each team must have exactly 3 members.",
  },
  {
    question: "Is there a registration fee, and how do I pay?",
    answer:
      "The entry fee is ₹150 per team. How to pay it is explained in the registration form, which you reach from the Register page. This site never sees or stores your card details or UPI PIN.",
  },
  {
    question: "Will I get a certificate?",
    answer: "Yes, the winners receive certificates.",
  },
  {
    question: "How will the prize pool be distributed?",
    answer:
      "The total prize pool is approximately ₹15,000. It is awarded to the top 2 teams in the afternoon Treasure Hunt. The amount for each place will be announced later.",
    awaitingConfirmation: true,
  },
  {
    question: "Who do I contact with a question?",
    answer:
      "Call any of the coordinators: Rahul M J (+91 81568 97436), Advaith U (+91 92073 30859) or Devinandha VR (+91 80894 05787). Their details are also in the Coordinators section and the footer.",
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
