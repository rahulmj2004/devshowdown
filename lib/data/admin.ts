import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/session";
import type { RegistrationRecord } from "@/types";

export type AdminSession =
  /** Supabase is not connected: there is no real authentication available. */
  | { state: "not_configured" }
  | { state: "signed_out" }
  /** Signed in, but the account is not in the `admins` table. */
  | { state: "forbidden"; email: string }
  | { state: "admin"; email: string; supabase: SupabaseClient };

/**
 * Resolves the organizer session on the server. `getUser()` verifies the token
 * with Supabase Auth rather than trusting the cookie, and admin status comes
 * from the database, never from the client.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const supabase = await createSessionClient();
  if (!supabase) return { state: "not_configured" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { state: "signed_out" };

  const email = user.email ?? "unknown account";
  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError || isAdmin !== true) return { state: "forbidden", email };

  return { state: "admin", email, supabase };
}

/** For Server Actions and Route Handlers: returns a client only for admins. */
export async function requireAdmin(): Promise<SupabaseClient | null> {
  const session = await getAdminSession();
  return session.state === "admin" ? session.supabase : null;
}

const registrationRowSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(["pending_payment", "confirmed", "superseded"]),
  payment_status: z.enum([
    "not_required",
    "pending",
    "paid",
    "failed",
    "verification_required",
  ]),
  is_test: z.boolean(),
  full_name: z.string(),
  email: z.string(),
  organization: z.string(),
  event_slug: z.string(),
  team_name: z.string().nullable(),
  team_members: z.array(z.string()),
  phone: z.string().nullable(),
  amount_paise: z.number().int(),
  upi_transaction_id: z.string().nullable(),
  created_at: z.string(),
});

/**
 * One row per event entry, from the organizer-only view defined in
 * supabase/migrations (0002, extended in 0003). Row Level Security on the underlying tables
 * applies to the signed-in organizer's client.
 */
export async function listRegistrations(
  supabase: SupabaseClient,
): Promise<{ records: RegistrationRecord[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("admin_registration_entries")
    .select(
      "id, reference, status, payment_status, is_test, full_name, email, organization, event_slug, team_name, team_members, phone, amount_paise, upi_transaction_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const parsed = z.array(registrationRowSchema).safeParse(data ?? []);
  if (error || !parsed.success) return { records: [], failed: true };

  return {
    failed: false,
    records: parsed.data.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      paymentStatus: row.payment_status,
      testPayment: row.is_test,
      fullName: row.full_name,
      email: row.email,
      organization: row.organization,
      eventSlug: row.event_slug,
      teamName: row.team_name,
      teamMembers: row.team_members,
      phone: row.phone,
      amountPaise: row.amount_paise,
      upiTransactionId: row.upi_transaction_id,
      createdAt: row.created_at,
    })),
  };
}

const adminResultRowSchema = z.object({
  id: z.string(),
  event_slug: z.string(),
  display_name: z.string(),
  score: z.coerce.number(),
  completion_time_ms: z.number().nullable(),
  published: z.boolean(),
});

export interface AdminResult {
  id: string;
  eventSlug: string;
  displayName: string;
  score: number;
  completionTimeMs: number | null;
  published: boolean;
}

export async function listAllResults(
  supabase: SupabaseClient,
): Promise<{ results: AdminResult[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("results")
    .select(
      "id, event_slug, display_name, score, completion_time_ms, published",
    )
    .order("event_slug")
    .order("score", { ascending: false })
    .limit(2000);

  const parsed = z.array(adminResultRowSchema).safeParse(data ?? []);
  if (error || !parsed.success) return { results: [], failed: true };

  return {
    failed: false,
    results: parsed.data.map((row) => ({
      id: row.id,
      eventSlug: row.event_slug,
      displayName: row.display_name,
      score: row.score,
      completionTimeMs: row.completion_time_ms,
      published: row.published,
    })),
  };
}
