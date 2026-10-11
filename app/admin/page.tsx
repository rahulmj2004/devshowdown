import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOutAction } from "@/app/admin/actions";
import { AdminDashboard } from "@/components/admin/dashboard";
import { Button } from "@/components/ui/button";
import {
  getAdminSession,
  listAllResults,
  listRegistrations,
} from "@/lib/data/admin";
import { getSiteSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Organizer dashboard",
  robots: { index: false, follow: false },
};

async function AdminGate() {
  const [session, settings] = await Promise.all([
    getAdminSession(),
    getSiteSettings(),
  ]);

  if (session.state === "not_configured") {
    return (
      <AdminDashboard
        mode="prototype"
        data={{
          settings,
          registrations: [],
          registrationsFailed: false,
          results: [],
          resultsFailed: false,
        }}
      />
    );
  }

  if (session.state === "signed_out") redirect("/admin/login");

  if (session.state === "forbidden") {
    return (
      <div className="container-page flex flex-col items-center py-28 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">
          Not an organizer account
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          {session.email} is signed in but does not have organizer access. Ask
          an existing organizer to add this account.
        </p>
        <form action={signOutAction} className="mt-8">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    );
  }

  const [registrations, results] = await Promise.all([
    listRegistrations(session.supabase),
    listAllResults(session.supabase),
  ]);

  return (
    <AdminDashboard
      mode="live"
      email={session.email}
      data={{
        settings,
        registrations: registrations.records,
        registrationsFailed: registrations.failed,
        results: results.results,
        resultsFailed: results.failed,
      }}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="container-page py-28 text-center text-sm text-muted"
        >
          Checking organizer access…
        </div>
      }
    >
      <AdminGate />
    </Suspense>
  );
}
