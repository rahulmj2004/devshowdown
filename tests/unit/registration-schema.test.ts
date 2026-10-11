import { describe, expect, it } from "vitest";
import {
  createRegistrationSchema,
  toFieldErrors,
} from "@/lib/validation/registration";

const KEY = "ab".repeat(32);

const schema = createRegistrationSchema({
  events: [
    { slug: "speed-typing", team: null },
    { slug: "code-debugging", team: { min: 1, max: 1 } },
    { slug: "tech-treasure-hunt", team: { min: 2, max: 4 } },
  ],
  phone: "optional",
  allowMultipleEvents: true,
});

const valid = {
  fullName: "Asha Menon",
  email: "asha@example.com",
  organization: "Example College",
  phone: "",
  eventSlugs: ["speed-typing"],
  teams: {},
  agree: true,
  clientKey: KEY,
};

const errorsFor = (input: unknown, target = schema) => {
  const result = target.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("registration schema", () => {
  it("accepts a valid registration and drops blank optional fields", () => {
    const result = schema.parse(valid);
    expect(result.phone).toBeUndefined();
    expect(result.entries).toEqual([
      { eventSlug: "speed-typing", teamName: null, members: [] },
    ]);
  });

  it("normalises the email so duplicates are detected regardless of case", () => {
    const result = schema.parse({ ...valid, email: "  Asha@Example.COM " });
    expect(result.email).toBe("asha@example.com");
  });

  it("reports a message for every missing required field", () => {
    const errors = errorsFor({
      fullName: "",
      email: "",
      organization: "",
      phone: "",
      eventSlugs: [],
      teams: {},
      agree: false,
      clientKey: KEY,
    });
    expect(Object.keys(errors).sort()).toEqual(
      ["agree", "email", "eventSlugs", "fullName", "organization"].sort(),
    );
  });

  it("rejects malformed emails", () => {
    expect(errorsFor({ ...valid, email: "not-an-email" }).email).toBe(
      "Enter a valid email address.",
    );
  });

  it("rejects events that are not open for registration", () => {
    expect(
      errorsFor({ ...valid, eventSlugs: ["coding-challenge"] }).eventSlugs,
    ).toBe("One of the chosen competitions is not open for registration.");
  });

  it("rejects the same event chosen twice", () => {
    expect(
      errorsFor({ ...valid, eventSlugs: ["speed-typing", "speed-typing"] })
        .eventSlugs,
    ).toBe("Each competition can only be chosen once.");
  });

  it("allows several events only when the organizers permit it", () => {
    const both = { ...valid, eventSlugs: ["speed-typing", "code-debugging"] };
    expect(errorsFor(both)).toEqual({});

    const single = createRegistrationSchema({
      events: [
        { slug: "speed-typing", team: null },
        { slug: "code-debugging", team: null },
      ],
      phone: "optional",
      allowMultipleEvents: false,
    });
    expect(errorsFor(both, single).eventSlugs).toBe(
      "You can enter one competition per registration.",
    );
  });

  it("requires agreement to the rules and privacy notice", () => {
    expect(errorsFor({ ...valid, agree: false }).agree).toBeDefined();
  });

  it("validates an optional phone number only when one is given", () => {
    expect(errorsFor({ ...valid, phone: "abc" }).phone).toBeDefined();
    expect(
      errorsFor({ ...valid, phone: "+91 98765 43210" }).phone,
    ).toBeUndefined();
  });

  it("requires a phone number when the organizer makes it mandatory", () => {
    const strict = createRegistrationSchema({
      events: [{ slug: "speed-typing", team: null }],
      phone: "required",
      allowMultipleEvents: true,
    });
    expect(errorsFor(valid, strict).phone).toBe("Enter your phone number.");
    expect(
      errorsFor({ ...valid, phone: "9876543210" }, strict).phone,
    ).toBeUndefined();
  });

  it("rejects a missing or malformed browser key", () => {
    expect(errorsFor({ ...valid, clientKey: "short" }).clientKey).toBeDefined();
    const { clientKey: _omitted, ...withoutKey } = valid;
    void _omitted;
    expect(errorsFor(withoutKey).clientKey).toBeDefined();
  });

  it("rejects non-object payloads sent straight to the server action", () => {
    expect(schema.safeParse(null).success).toBe(false);
    expect(schema.safeParse("x").success).toBe(false);
  });
});

describe("team rules", () => {
  const hunt = { ...valid, eventSlugs: ["tech-treasure-hunt"] };

  it("keeps an optional team name while the rule is unconfirmed", () => {
    const result = schema.parse({
      ...valid,
      teams: {
        "speed-typing": { teamName: "  Fast Fingers ", members: ["x"] },
      },
    });
    // Member names are not collected for an event with no confirmed rule.
    expect(result.entries[0]).toEqual({
      eventSlug: "speed-typing",
      teamName: "Fast Fingers",
      members: [],
    });
  });

  it("requires a team name and enough members for a team event", () => {
    const errors = errorsFor({ ...hunt, teams: {} });
    expect(errors["teams.tech-treasure-hunt.teamName"]).toBe(
      "Enter a team name.",
    );
    expect(errors["teams.tech-treasure-hunt.members"]).toBe(
      "This event needs a team of 2 to 4, including you.",
    );
  });

  it("counts the registrant toward the team size", () => {
    const team = (members: string[]) => ({
      ...hunt,
      teams: { "tech-treasure-hunt": { teamName: "Null Pointers", members } },
    });
    expect(errorsFor(team(["Ravi Kumar"]))).toEqual({});
    expect(errorsFor(team(["A B", "C D", "E F"]))).toEqual({});
    expect(
      errorsFor(team(["A B", "C D", "E F", "G H"]))[
        "teams.tech-treasure-hunt.members"
      ],
    ).toBeDefined();
  });

  it("points at the exact member whose name is missing", () => {
    const errors = errorsFor({
      ...hunt,
      teams: {
        "tech-treasure-hunt": {
          teamName: "Null Pointers",
          members: ["Ravi Kumar", " "],
        },
      },
    });
    expect(errors).toEqual({
      "teams.tech-treasure-hunt.members.1": "Enter this team member's name.",
    });
  });

  it("ignores team details sent for a solo event", () => {
    const result = schema.parse({
      ...valid,
      eventSlugs: ["code-debugging"],
      teams: { "code-debugging": { members: ["Someone Else"] } },
    });
    expect(result.entries[0].members).toEqual([]);
  });
});
