import { describe, expect, it } from "vitest";
import { events, getEventBySlug } from "@/config/events";
import { toCsv } from "@/lib/csv";
import { demoResults } from "@/lib/data/demo-results";
import { buildLeaderboard } from "@/lib/data/leaderboard";
import {
  getRegistrationLabel,
  isEventRegistrationOpen,
} from "@/lib/registration-status";
import { formatRupees } from "@/lib/utils";
import { parseEnv } from "@/lib/validation/env";

describe("event config", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = events.map((event) => event.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("looks events up by slug", () => {
    expect(getEventBySlug("code-debugging")?.title).toBe("Debugging");
    expect(getEventBySlug("nope")).toBeUndefined();
  });
});

describe("registration status", () => {
  const event = { status: "upcoming", registrationEnabled: true } as const;

  it("is closed until the organizer opens registration", () => {
    expect(isEventRegistrationOpen(event, "not_open")).toBe(false);
    expect(getRegistrationLabel(event, "not_open")).toBe(
      "Registration not open yet",
    );
  });

  it("opens only for upcoming, enabled events", () => {
    expect(isEventRegistrationOpen(event, "open")).toBe(true);
    expect(
      isEventRegistrationOpen({ ...event, registrationEnabled: false }, "open"),
    ).toBe(false);
    expect(
      isEventRegistrationOpen({ ...event, status: "completed" }, "open"),
    ).toBe(false);
    expect(getRegistrationLabel({ ...event, status: "live" }, "open")).toBe(
      "Registration closed",
    );
  });
});

describe("buildLeaderboard", () => {
  it("ranks each event separately and omits events without results", () => {
    const groups = buildLeaderboard(
      demoResults.filter((row) => row.eventSlug !== "coding-challenge"),
    );
    expect(groups.map((group) => group.event.slug)).toEqual([
      "code-debugging",
      "blind-coding",
      "tech-treasure-hunt",
      "speed-typing",
    ]);
    for (const group of groups) expect(group.rows[0].rank).toBe(1);
  });

  it("filters to a single event", () => {
    const groups = buildLeaderboard(demoResults, "speed-typing");
    expect(groups).toHaveLength(1);
    expect(
      groups[0].rows.every((row) => row.eventSlug === "speed-typing"),
    ).toBe(true);
  });
});

describe("toCsv", () => {
  it("quotes cells containing commas, quotes and newlines", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ['say "hi"', "x,y"],
          ["line\nbreak", null],
        ],
      ),
    ).toBe('a,b\r\n"say ""hi""","x,y"\r\n"line\nbreak",');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(toCsv(["name"], [["=HYPERLINK(1)"], ["+1"], ["@x"]])).toBe(
      "name\r\n'=HYPERLINK(1)\r\n'+1\r\n'@x",
    );
  });
});

describe("formatRupees", () => {
  it("uses Indian digit grouping", () => {
    expect(formatRupees(15000)).toBe("₹15,000");
    expect(formatRupees(150000)).toBe("₹1,50,000");
  });
});

describe("parseEnv", () => {
  it("treats everything as optional so the site runs in demo mode", () => {
    expect(parseEnv({})).toEqual({});
    expect(parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "  " })).toEqual({});
  });

  it("requires the Supabase URL and anon key together", () => {
    expect(() =>
      parseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("rejects a service-role key without a project", () => {
    expect(() => parseEnv({ SUPABASE_SERVICE_ROLE_KEY: "secret" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("rejects unknown registration statuses", () => {
    expect(() => parseEnv({ REGISTRATION_STATUS: "maybe" })).toThrow();
  });

  it("requires both Razorpay keys, so a half-configured gateway cannot start", () => {
    expect(() => parseEnv({ RAZORPAY_KEY_ID: "rzp_test_x" })).toThrow(
      /RAZORPAY_KEY_SECRET/,
    );
    expect(() => parseEnv({ RAZORPAY_KEY_SECRET: "s" })).toThrow(
      /RAZORPAY_KEY_ID/,
    );
  });

  it("only accepts the one documented payment mode override", () => {
    expect(parseEnv({ PAYMENT_MODE: "mock" }).PAYMENT_MODE).toBe("mock");
    expect(() => parseEnv({ PAYMENT_MODE: "live" })).toThrow();
  });

  it("parses the development fee override as whole rupees", () => {
    expect(parseEnv({ DEV_FEE_OVERRIDE_INR: "50" }).DEV_FEE_OVERRIDE_INR).toBe(
      50,
    );
    expect(() => parseEnv({ DEV_FEE_OVERRIDE_INR: "-5" })).toThrow();
  });
});
