import { ArrowRight } from "lucide-react";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { buildLeaderboard } from "@/lib/data/leaderboard";
import type { ResultEntry } from "@/types";

/**
 * Home-page leaderboard teaser. It appears only once real results have been
 * published: before the event there is nothing to rank, and sample rows on
 * the front page would read as real participants.
 */
export function LeaderboardPreview({
  entries,
  index,
}: {
  entries: readonly ResultEntry[];
  /** Two-digit section marker. */
  index: string;
}) {
  const group = buildLeaderboard(entries)[0];
  if (!group) return null;

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="border-t border-line bg-bg-soft"
    >
      <div className="container-page grid items-center gap-12 py-24 sm:py-32 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <Reveal>
          <SectionHeading
            id="leaderboard-heading"
            index={index}
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

        <Reveal delay={0.1}>
          <LeaderboardTable
            event={group.event}
            rows={group.rows}
            limit={5}
            headingLevel="h3"
          />
        </Reveal>
      </div>
    </section>
  );
}
