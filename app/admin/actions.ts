"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getEventSlugs } from "@/config/events";
import { requireAdmin } from "@/lib/data/admin";
import { CACHE_TAGS } from "@/lib/data/tags";
import { getRegistrationContext } from "@/lib/registration/context";
import { reviewUpiPayment } from "@/lib/registration/service";
import { REFERENCE_PATTERN } from "@/lib/validation/registration";
import { createSessionClient } from "@/lib/supabase/session";

export type ActionState = { ok: boolean; message: string } | null;

const NOT_AUTHORIZED: ActionState = {
  ok: false,
  message: "You are not signed in as an organizer.",
};

const credentialsSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1).max(200),
});

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createSessionClient();
  if (!supabase) {
    return { ok: false, message: "Authentication is not configured." };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter your email address and password." };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Deliberately generic: do not reveal whether the account exists.
    return { ok: false, message: "Incorrect email or password." };
  }
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

const settingsSchema = z.object({
  registration_status: z.enum(["not_open", "open", "closed"]),
  announcement_label: z.string().trim().min(1).max(40),
  announcement_text: z.string().trim().min(1).max(160),
});

export async function updateSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin();
  if (!supabase) return NOT_AUTHORIZED;

  const parsed = settingsSchema.safeParse({
    registration_status: formData.get("registration_status"),
    announcement_label: formData.get("announcement_label"),
    announcement_text: formData.get("announcement_text"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the fields: label up to 40 characters, text up to 160.",
    };
  }

  // RLS filters silently, so confirm a row was actually updated.
  const { data, error } = await supabase
    .from("site_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, message: "Settings could not be saved." };
  }

  updateTag(CACHE_TAGS.settings);
  return { ok: true, message: "Settings saved." };
}

const resultSchema = z.object({
  event_slug: z
    .string()
    .refine((slug) => getEventSlugs().includes(slug), "Unknown event"),
  display_name: z.string().trim().min(1).max(80),
  score: z.coerce.number().finite(),
  time_seconds: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().min(0).max(864_000).optional(),
  ),
  published: z.boolean(),
});

export async function createResultAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin();
  if (!supabase) return NOT_AUTHORIZED;

  const parsed = resultSchema.safeParse({
    event_slug: formData.get("event_slug"),
    display_name: formData.get("display_name"),
    score: formData.get("score"),
    time_seconds: formData.get("time_seconds"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Choose an event and enter a display name and a numeric score.",
    };
  }

  const { time_seconds, ...row } = parsed.data;
  const { data, error } = await supabase
    .from("results")
    .insert({
      ...row,
      completion_time_ms:
        time_seconds === undefined ? null : Math.round(time_seconds * 1000),
    })
    .select("id");
  if (error || !data?.length) {
    return { ok: false, message: "The result could not be saved." };
  }

  updateTag(CACHE_TAGS.results);
  return {
    ok: true,
    message: row.published
      ? "Result saved and published."
      : "Result saved as a draft.",
  };
}

const resultIdSchema = z.uuid();

export async function setResultPublishedAction(
  formData: FormData,
): Promise<void> {
  const supabase = await requireAdmin();
  const id = resultIdSchema.safeParse(formData.get("id"));
  if (!supabase || !id.success) return;

  await supabase
    .from("results")
    .update({ published: formData.get("published") === "true" })
    .eq("id", id.data);
  updateTag(CACHE_TAGS.results);
  refresh();
}

export async function deleteResultAction(formData: FormData): Promise<void> {
  const supabase = await requireAdmin();
  const id = resultIdSchema.safeParse(formData.get("id"));
  if (!supabase || !id.success) return;

  await supabase.from("results").delete().eq("id", id.data);
  updateTag(CACHE_TAGS.results);
  refresh();
}

const upiReviewSchema = z.object({
  reference: z.string().regex(REFERENCE_PATTERN),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Approves or rejects a UPI payment a participant reported, after the
 * organizer has checked it against their own UPI history.
 */
export async function reviewUpiPaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin();
  if (!supabase) return NOT_AUTHORIZED;

  const parsed = upiReviewSchema.safeParse({
    reference: formData.get("reference"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { ok: false, message: "Unknown registration." };

  const outcome = await reviewUpiPayment(
    await getRegistrationContext(),
    parsed.data.reference,
    parsed.data.decision,
  );
  refresh();

  const { reference } = parsed.data;
  switch (outcome) {
    case "approved":
      return { ok: true, message: `${reference} marked as paid.` };
    case "rejected":
      return {
        ok: true,
        message: `${reference} rejected. The participant can enter another transaction ID.`,
      };
    case "nothing_to_review":
      return {
        ok: false,
        message: `${reference} has no UPI payment waiting for review.`,
      };
    case "needs_attention":
      return {
        ok: false,
        message: `${reference} could not be settled automatically (it may have been replaced by a newer registration). Check it by hand.`,
      };
    default:
      return { ok: false, message: "The decision could not be saved." };
  }
}
