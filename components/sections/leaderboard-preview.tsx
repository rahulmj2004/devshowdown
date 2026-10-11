import { ArrowRight } from "lucide-react";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { demoResults } from "@/lib/data/demo-results";
import { buildLeaderboard } from "@/lib/data/leaderboard";
import type { ResultEntry } from "@/types";

/**
 * Home-page leaderboard teaser. Shows real published results when there are
 * any; otherwise it previews the layout with rows that are explicitly labelled
 * as demonstration data.
 */
export function LeaderboardPreview({
  entries,
}: {
  entries: readonly ResultEntry[];
}) {
  const real = buildLeaderboard(entries);
  const isDemo = real.length === 0;
  const group = (isDemo ? buildLeaderboard(demoResults) : real)[0];

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="border-t border-line bg-bg-soft"
    >
      <div className="container-page grid items-center gap-12 py-24 sm:py-32 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <Reveal>
          <SectionHeading
            id="leaderboard-heading"
            index="07"
            eyebrow="Leaderboard"
            title="Every result, ranked"
            description="Once competitions are run, published results appear on the leaderboard, ranked separately for each event."
          />
          <ButtonLink
            href="/leaderboard"
            variant="secondary"
            className="group mt-8"
          >
            View leaderboard
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            />
          </ButtonLink>
        </Reveal>

        {group && (
          <Reveal delay={0.1}>
            {isDemo && (
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <Badge tone="warn" dot>
                  Demonstration data
                </Badge>
                <p className="text-xs text-subtle">
                  Sample rows showing the layout. Not real participants or
                  results.
                </p>
              </div>
            )}
            <LeaderboardTable
              event={group.event}
              rows={group.rows}
              limit={5}
              headingLevel="h3"
            />
          </Reveal>
        )}
      </div>
    </section>
  );
}
