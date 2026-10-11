import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/admin/action-forms";
import { Notice } from "@/components/ui/notice";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Organizer sign-in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="container-page flex justify-center py-20 sm:py-28">
      <div className="w-full max-w-md card p-6 sm:p-8">
        <p className="eyebrow text-violet-bright">Organizers</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
          Sign in
        </h1>

        {isSupabaseConfigured ? (
          <div className="mt-6">
            <SignInForm />
          </div>
        ) : (
          <Notice
            tone="warn"
            title="Authentication is not configured"
            className="mt-6"
          >
            Organizer sign-in needs a Supabase project. Until one is connected
            there is no login, and nothing is protected or saved.{" "}
            <Link
              href="/admin"
              className="rounded font-medium text-fg underline underline-offset-4 hover:text-violet-bright"
            >
              View the dashboard prototype
            </Link>
          </Notice>
        )}
      </div>
    </div>
  );
}
