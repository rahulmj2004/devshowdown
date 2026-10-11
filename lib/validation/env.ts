import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

export const envSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    REGISTRATION_STATUS: z.preprocess(
      emptyToUndefined,
      z.enum(["not_open", "open", "closed"]).optional(),
    ),
    RAZORPAY_KEY_ID: optionalString,
    RAZORPAY_KEY_SECRET: optionalString,
    RAZORPAY_WEBHOOK_SECRET: optionalString,
    PAYMENT_MODE: z.preprocess(emptyToUndefined, z.enum(["mock"]).optional()),
    DEV_FEE_OVERRIDE_INR: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(100_000).optional(),
    ),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,
  })
  .superRefine((value, ctx) => {
    const hasUrl = Boolean(value.NEXT_PUBLIC_SUPABASE_URL);
    const hasAnonKey = Boolean(value.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    if (hasUrl !== hasAnonKey) {
      ctx.addIssue({
        code: "custom",
        path: [
          hasUrl ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "NEXT_PUBLIC_SUPABASE_URL",
        ],
        message:
          "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set together.",
      });
    }
    if (value.SUPABASE_SERVICE_ROLE_KEY && !(hasUrl && hasAnonKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message:
          "SUPABASE_SERVICE_ROLE_KEY requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      });
    }

    const hasKeyId = Boolean(value.RAZORPAY_KEY_ID);
    const hasKeySecret = Boolean(value.RAZORPAY_KEY_SECRET);
    if (hasKeyId !== hasKeySecret) {
      ctx.addIssue({
        code: "custom",
        path: [hasKeyId ? "RAZORPAY_KEY_SECRET" : "RAZORPAY_KEY_ID"],
        message:
          "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set together.",
      });
    }
    if (Boolean(value.RESEND_API_KEY) !== Boolean(value.EMAIL_FROM)) {
      ctx.addIssue({
        code: "custom",
        path: [value.RESEND_API_KEY ? "EMAIL_FROM" : "RESEND_API_KEY"],
        message: "RESEND_API_KEY and EMAIL_FROM must be set together.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates environment variables and fails loudly with a readable message. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return result.data;
}
