import { z } from "zod";
import type { PhoneFieldMode, TeamRule } from "@/types";

export interface RegistrationSchemaEvent {
  slug: string;
  /** `null` until the organizers confirm the team rule for this event. */
  team: TeamRule | null;
}

export interface RegistrationSchemaOptions {
  /** Events a participant is currently allowed to pick. */
  events: readonly RegistrationSchemaEvent[];
  phone: PhoneFieldMode;
  allowMultipleEvents: boolean;
}

const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;
/** 32 random bytes, hex encoded, generated in the browser. */
export const CLIENT_KEY_PATTERN = /^[a-f0-9]{64}$/;
export const REFERENCE_PATTERN = /^[A-Z]{3,4}-[A-Z0-9]{8}$/;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const teamNameSchema = z
  .string()
  .trim()
  .min(2, "Team name must be at least 2 characters.")
  .max(60, "Team name must be 60 characters or fewer.");

const memberNameSchema = z
  .string({ error: "Enter this team member's name." })
  .trim()
  .min(2, "Enter this team member's name.")
  .max(100, "Name must be 100 characters or fewer.");

/** A team event is one whose confirmed rule allows more than one member. */
export function isTeamEvent(team: TeamRule | null): team is TeamRule {
  return team !== null && team.max > 1;
}

/**
 * The single registration schema, shared by the browser flow and the server
 * so both sides enforce exactly the same rules. The server never trusts the
 * browser's copy: it rebuilds the schema from its own configuration.
 */
export function createRegistrationSchema(options: RegistrationSchemaOptions) {
  const eventBySlug = new Map(
    options.events.map((event) => [event.slug, event]),
  );

  const phone =
    options.phone === "required"
      ? z.preprocess(
          blankToUndefined,
          z
            .string({ error: "Enter your phone number." })
            .trim()
            .regex(PHONE_PATTERN, "Enter a valid phone number."),
        )
      : z.preprocess(
          blankToUndefined,
          z
            .string()
            .trim()
            .regex(PHONE_PATTERN, "Enter a valid phone number.")
            .optional(),
        );

  return z
    .object({
      fullName: z
        .string({ error: "Enter your full name." })
        .trim()
        .min(2, "Enter your full name.")
        .max(100, "Name must be 100 characters or fewer."),
      email: z
        .string({ error: "Enter your email address." })
        .trim()
        .toLowerCase()
        .min(1, "Enter your email address.")
        .max(254, "Email address is too long.")
        .pipe(z.email("Enter a valid email address.")),
      organization: z
        .string({ error: "Enter your college or organization." })
        .trim()
        .min(2, "Enter your college or organization.")
        .max(120, "Must be 120 characters or fewer."),
      phone,
      eventSlugs: z
        .array(z.string(), { error: "Choose at least one competition." })
        .min(1, "Choose at least one competition.")
        .max(
          options.allowMultipleEvents ? Math.max(options.events.length, 1) : 1,
          "You can enter one competition per registration.",
        )
        .refine(
          (slugs) => new Set(slugs).size === slugs.length,
          "Each competition can only be chosen once.",
        )
        .refine(
          (slugs) => slugs.every((slug) => eventBySlug.has(slug)),
          "One of the chosen competitions is not open for registration.",
        ),
      /** Per-event team details, keyed by event slug. */
      teams: z
        .record(
          z.string(),
          z.object({
            teamName: z.preprocess(blankToUndefined, z.string().optional()),
            members: z.array(z.string()).max(20).optional(),
          }),
        )
        .default({}),
      agree: z
        .boolean({ error: "You must agree before registering." })
        .refine(
          (value) => value === true,
          "You must agree to the rules and privacy notice.",
        ),
      clientKey: z
        .string({ error: "Reload the page and try again." })
        .regex(CLIENT_KEY_PATTERN, "Reload the page and try again."),
    })
    .superRefine((value, ctx) => {
      for (const slug of value.eventSlugs) {
        const event = eventBySlug.get(slug);
        if (!event) continue;
        const team = value.teams[slug] ?? {};
        const rule = event.team;
        const teamEvent = isTeamEvent(rule);

        const name = teamNameSchema.safeParse(team.teamName);
        if (team.teamName !== undefined && !name.success) {
          ctx.addIssue({
            code: "custom",
            path: ["teams", slug, "teamName"],
            message: name.error.issues[0].message,
          });
        } else if (team.teamName === undefined && teamEvent) {
          ctx.addIssue({
            code: "custom",
            path: ["teams", slug, "teamName"],
            message: "Enter a team name.",
          });
        }

        if (!isTeamEvent(rule)) continue;
        // The rule counts the registrant; `members` lists everyone else.
        const members = team.members ?? [];
        const size = members.length + 1;
        if (size < rule.min || size > rule.max) {
          ctx.addIssue({
            code: "custom",
            path: ["teams", slug, "members"],
            message:
              rule.min === rule.max
                ? `This event needs a team of exactly ${rule.min}, including you.`
                : `This event needs a team of ${rule.min} to ${rule.max}, including you.`,
          });
        }
        members.forEach((member, index) => {
          const parsed = memberNameSchema.safeParse(member);
          if (!parsed.success) {
            ctx.addIssue({
              code: "custom",
              path: ["teams", slug, "members", index],
              message: parsed.error.issues[0].message,
            });
          }
        });
      }
    })
    .transform((value) => ({
      fullName: value.fullName,
      email: value.email,
      organization: value.organization,
      phone: value.phone,
      agree: value.agree,
      clientKey: value.clientKey,
      /** Normalised entries: only what each chosen event actually uses. */
      entries: value.eventSlugs.map((slug) => {
        const event = eventBySlug.get(slug);
        const team = value.teams[slug] ?? {};
        return {
          eventSlug: slug,
          teamName: team.teamName?.trim() || null,
          members:
            event && isTeamEvent(event.team)
              ? (team.members ?? []).map((member) => member.trim())
              : [],
        };
      }),
    }));
}

export type RegistrationSchema = ReturnType<typeof createRegistrationSchema>;
export type RegistrationInput = z.output<RegistrationSchema>;

/** What the form holds while it is being filled in. */
export interface RegistrationFormValues {
  fullName: string;
  email: string;
  organization: string;
  phone: string;
  eventSlugs: string[];
  teams: Record<string, { teamName: string; members: string[] }>;
  agree: boolean;
  clientKey: string;
}

/**
 * Error messages keyed by dotted field path: "email", "eventSlugs",
 * "teams.speed-typing.teamName", "teams.speed-typing.members.0", ...
 */
export type RegistrationFieldErrors = Record<string, string>;

/** Collapses a Zod error to the first message per field path. */
export function toFieldErrors(error: z.ZodError): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !(path in errors)) errors[path] = issue.message;
  }
  return errors;
}

/** Credentials that identify one registration to the browser that made it. */
export const registrationAccessSchema = z.object({
  reference: z.string().regex(REFERENCE_PATTERN),
  clientKey: z.string().regex(CLIENT_KEY_PATTERN),
});

export const checkoutPayloadSchema = z.object({
  razorpay_payment_id: z.string().min(1).max(120),
  razorpay_order_id: z.string().min(1).max(120),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});
