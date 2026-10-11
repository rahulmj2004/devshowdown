import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EventFilter } from "@/components/leaderboard/event-filter";
import {
  LeaderboardSkeleton,
  LeaderboardTable,
} from "@/components/leaderboard/leaderboard-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { getEventBySlug, getEvents } from "@/config/events";
import { demoResults } from "@/lib/data/demo-results";
import { buildLeaderboard } from "@/lib/data/leaderboard";
import { getPublishedResults } from "@/lib/data/results";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Published DevShowdown results, ranked for each competition.",
  alternates: { canonical: "/leaderboard" },
};

const inlineLink =
  "rounded font-medium text-fg underline underline-offset-4 hover:text-violet-bright";

async function LeaderboardContent({
  searchParams,
}: Pick<PageProps<"/leaderboard">, "searchParams">) {
  const [params, published] = await Promise.all([
    searchParams,
    getPublishedResults(),
  ]);
  const requested = typeof params.event === "string" ? params.event : undefined;
  const activeSlug =
    requested && getEventBySlug(requested) ? requested : undefined;
  const demo = params.demo === "1";

  const groups = buildLeaderboard(
    demo ? demoResults : published.entries,
    activeSlug,
  );
  const baseHref = activeSlug
    ? `/leaderboard?event=${activeSlug}`
    : "/leaderboard";
  const demoHref = `${baseHref}${activeSlug ? "&" : "?"}demo=1`;

  return (
    <div className="space-y-8">
      <EventFilter events={getEvents()} activeSlug={activeSlug} demo={demo} />

      {demo && (
        <Notice tone="warn" title="Demonstration data">
          These rows are sample data for previewing the layout. They are not
          real participants or results.{" "}
          <Link href={baseHref} className={inlineLink}>
            Hide demonstration data
          </Link>
        </Notice>
      )}

      {!demo && published.source === "error" && (
        <Notice tone="danger" title="Results could not be loaded">
          The leaderboard service did not respond. Please try again shortly.
        </Notice>
      )}

      {groups.length > 0 ? (
        groups.map((group) => (
          <LeaderboardTable
            key={group.event.slug}
            event={group.event}
            rows={group.rows}
          />
        ))
      ) : (
        <EmptyState
          icon={<Trophy aria-hidden="true" />}
          title="No results published yet"
          action={
            !demo && (
              <Link href={demoHref} className={inlineLink + " text-sm"}>
                Preview the layout with demonstration data
              </Link>
            )
          }
        >
          Results will appear here once competitions have been run and the
          organizers publish them.
        </EmptyState>
      )}
    </div>
  );
}

export default function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  return (
    <>
      <PageHeader
        eyebrow="Leaderboard"
        title="Leaderboard"
        description="Results are ranked separately for each competition, using that event's own scoring."
      />
      <div className="container-page py-14 sm:py-20">
        <Suspense fallback={<LeaderboardSkeleton />}>
          <LeaderboardContent searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
