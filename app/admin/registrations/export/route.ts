import { connection } from "next/server";
import { getEventBySlug } from "@/config/events";
import { toCsv } from "@/lib/csv";
import { listRegistrations, requireAdmin } from "@/lib/data/admin";

/** Organizer-only CSV export. Authorization is checked on every request. */
export async function GET() {
  await connection();

  const supabase = await requireAdmin();
  if (!supabase) {
    return new Response("Not authorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { records, failed } = await listRegistrations(supabase);
  if (failed) {
    return new Response("Could not load registrations", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const csv = toCsv(
    [
      "Reference",
      "Status",
      "Payment",
      "Test payment",
      "Name",
      "Email",
      "Organization",
      "Event",
      "Team",
      "Team members",
      "Phone",
      "Registered at",
    ],
    records.map((record) => [
      record.reference,
      record.status,
      record.paymentStatus,
      record.testPayment ? "yes" : "no",
      record.fullName,
      record.email,
      record.organization,
      getEventBySlug(record.eventSlug)?.title ?? record.eventSlug,
      record.teamName,
      record.teamMembers.join("; "),
      record.phone,
      record.createdAt,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="devshowdown-registrations.csv"',
      "Cache-Control": "no-store",
    },
  });
}
