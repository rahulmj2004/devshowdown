import { Download, Eye, EyeOff, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  deleteResultAction,
  setResultPublishedAction,
  signOutAction,
} from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { getEventBySlug, getEvents } from "@/config/events";
import type { AdminResult } from "@/lib/data/admin";
import { formatCompletionTime, formatScore } from "@/lib/scoring";
import type { RegistrationRecord, SiteSettings } from "@/types";
import { ResultForm, SettingsForm } from "./action-forms";

export interface DashboardData {
  settings: SiteSettings;
  registrations: RegistrationRecord[];
  registrationsFailed: boolean;
  results: AdminResult[];
  resultsFailed: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const eventTitle = (slug: string) => getEventBySlug(slug)?.title ?? slug;

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const th = "px-3 py-2.5 text-left font-normal whitespace-nowrap";
const td = "px-3 py-3 align-top";

function PaymentBadge({ record }: { record: RegistrationRecord }) {
  if (
    record.status === "superseded" &&
    record.paymentStatus !== "verification_required"
  ) {
    return <Badge tone="neutral">Superseded</Badge>;
  }
  const states = {
    paid: { label: "Paid", tone: "success" },
    not_required: { label: "No fee", tone: "neutral" },
    pending: { label: "Awaiting payment", tone: "neutral" },
    failed: { label: "Payment failed", tone: "warn" },
    verification_required: { label: "Needs review", tone: "warn" },
  } as const;
  const state = states[record.paymentStatus];
  return (
    <Badge tone={state.tone} dot>
      {state.label}
      {record.testPayment ? " (test)" : ""}
    </Badge>
  );
}

function EmptyRow({
  columns,
  children,
}: {
  columns: number;
  children: string;
}) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="px-3 py-10 text-center text-sm text-subtle"
      >
        {children}
      </td>
    </tr>
  );
}

/**
 * Organizer dashboard. In "prototype" mode (no backend connected) it renders
 * the same layout with disabled controls and no data, and says so.
 */
export function AdminDashboard({
  mode,
  email,
  data,
}: {
  mode: "live" | "prototype";
  email?: string;
  data: DashboardData;
}) {
  const live = mode === "live";
  const events = getEvents().map(({ slug, title }) => ({ slug, title }));
  const publishedCount = data.results.filter(
    (result) => result.published,
  ).length;

  const stats = [
    {
      label: "Registrations",
      value: live ? String(data.registrations.length) : "—",
    },
    {
      label: "Results published",
      value: live ? `${publishedCount} / ${data.results.length}` : "—",
    },
    { label: "Events configured", value: String(events.length) },
  ];

  return (
    <div className="container-page space-y-8 py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-violet-bright">Organizers</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Dashboard
          </h1>
          {live && email && (
            <p className="mt-2 text-sm text-muted">Signed in as {email}</p>
          )}
        </div>
        {live ? (
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        ) : (
          <Badge tone="warn" dot>
            Prototype
          </Badge>
        )}
      </div>

      {!live && (
        <Notice
          tone="warn"
          title="Prototype: no authentication or database is connected"
        >
          This is a layout preview only. It is publicly viewable, contains no
          participant data, and every control is disabled. Nothing here signs
          anyone in or saves anything. Connect Supabase (see the README) to
          enable real organizer sign-in and persistence.
        </Notice>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <dt className="eyebrow text-subtle">{stat.label}</dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight text-fg tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <Panel
        title="Registration and announcement"
        description="Controls whether the registration form accepts entries, and the badge shown in the hero."
      >
        <SettingsForm
          disabled={!live}
          values={{
            registrationStatus: data.settings.registrationStatus,
            announcementLabel: data.settings.announcementLabel,
            announcementText: data.settings.announcementText,
          }}
        />
      </Panel>

      <Panel
        title="Registrations"
        description="Private participant records. Visible to organizers only."
        action={
          live ? (
            <a
              href="/admin/registrations/export"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </a>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </Button>
          )
        }
      >
        {data.registrationsFailed && (
          <Notice
            tone="danger"
            title="Registrations could not be loaded"
            className="mb-4"
          />
        )}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[60rem] text-sm">
            <caption className="sr-only">Registrations</caption>
            <thead>
              <tr className="border-b border-line eyebrow text-subtle">
                <th scope="col" className={th}>
                  Name
                </th>
                <th scope="col" className={th}>
                  Reference
                </th>
                <th scope="col" className={th}>
                  Payment
                </th>
                <th scope="col" className={th}>
                  Email
                </th>
                <th scope="col" className={th}>
                  Organization
                </th>
                <th scope="col" className={th}>
                  Event
                </th>
                <th scope="col" className={th}>
                  Team
                </th>
                <th scope="col" className={th}>
                  Phone
                </th>
                <th scope="col" className={th}>
                  Registered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.registrations.length === 0 ? (
                <EmptyRow columns={9}>
                  {live
                    ? "No registrations yet."
                    : "Registrations appear here once a database is connected."}
                </EmptyRow>
              ) : (
                data.registrations.map((record) => (
                  <tr key={record.id}>
                    <th
                      scope="row"
                      className={`${td} text-left font-medium text-fg`}
                    >
                      {record.fullName}
                    </th>
                    <td className={`${td} font-mono text-xs text-muted`}>
                      {record.reference}
                    </td>
                    <td className={td}>
                      <PaymentBadge record={record} />
                    </td>
                    <td className={`${td} text-muted`}>{record.email}</td>
                    <td className={`${td} text-muted`}>
                      {record.organization}
                    </td>
                    <td className={`${td} text-muted`}>
                      {eventTitle(record.eventSlug)}
                    </td>
                    <td className={`${td} text-muted`}>
                      {record.teamName ?? "—"}
                      {record.teamMembers.length > 0 && (
                        <span className="block text-xs text-subtle">
                          + {record.teamMembers.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-muted`}>
                      {record.phone ?? "—"}
                    </td>
                    <td className={`${td} whitespace-nowrap text-muted`}>
                      {dateFormatter.format(new Date(record.createdAt))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Results and leaderboard"
        description="Enter results as drafts, then publish them to the public leaderboard."
      >
        <ResultForm events={events} disabled={!live} />
        {data.resultsFailed && (
          <Notice
            tone="danger"
            title="Results could not be loaded"
            className="mt-6"
          />
        )}
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Results</caption>
            <thead>
              <tr className="border-b border-line eyebrow text-subtle">
                <th scope="col" className={th}>
                  Event
                </th>
                <th scope="col" className={th}>
                  Display name
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Score
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Time
                </th>
                <th scope="col" className={th}>
                  State
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.results.length === 0 ? (
                <EmptyRow columns={6}>
                  {live
                    ? "No results entered yet."
                    : "Results appear here once a database is connected."}
                </EmptyRow>
              ) : (
                data.results.map((result) => (
                  <tr key={result.id}>
                    <td className={`${td} text-muted`}>
                      {eventTitle(result.eventSlug)}
                    </td>
                    <th
                      scope="row"
                      className={`${td} text-left font-medium text-fg`}
                    >
                      {result.displayName}
                    </th>
                    <td
                      className={`${td} text-right font-mono text-fg tabular-nums`}
                    >
                      {formatScore(result.score)}
                    </td>
                    <td
                      className={`${td} text-right font-mono text-muted tabular-nums`}
                    >
                      {formatCompletionTime(result.completionTimeMs)}
                    </td>
                    <td className={td}>
                      <Badge
                        tone={result.published ? "success" : "neutral"}
                        dot
                      >
                        {result.published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className={td}>
                      <div className="flex justify-end gap-2">
                        <form action={setResultPublishedAction}>
                          <input type="hidden" name="id" value={result.id} />
                          <input
                            type="hidden"
                            name="published"
                            value={String(!result.published)}
                          />
                          <Button type="submit" variant="secondary" size="sm">
                            {result.published ? (
                              <EyeOff aria-hidden="true" className="size-4" />
                            ) : (
                              <Eye aria-hidden="true" className="size-4" />
                            )}
                            {result.published ? "Unpublish" : "Publish"}
                            <span className="sr-only">
                              {" "}
                              {result.displayName}
                            </span>
                          </Button>
                        </form>
                        <form action={deleteResultAction}>
                          <input type="hidden" name="id" value={result.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            <Trash2 aria-hidden="true" className="size-4" />
                            <span className="sr-only">
                              Delete result for {result.displayName}
                            </span>
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Managed in code for now"
        description="These are edited in the repository today. The data layer is ready for them to move into this dashboard."
      >
        <ul className="grid gap-3 text-sm text-muted sm:grid-cols-2">
          <li className="rounded-xl border border-line p-4">
            <span className="font-medium text-fg">
              Events, rules and descriptions
            </span>
            <span className="mt-1 block font-mono text-xs text-subtle">
              config/events.ts
            </span>
          </li>
          <li className="rounded-xl border border-line p-4">
            <span className="font-medium text-fg">
              Prize distribution, dates, venue, contact, FAQ
            </span>
            <span className="mt-1 block font-mono text-xs text-subtle">
              config/site.ts
            </span>
          </li>
        </ul>
      </Panel>
    </div>
  );
}
