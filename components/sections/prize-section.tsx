import { Badge } from "@/components/ui/badge";
import { Counter } from "@/components/ui/counter";
import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/config/site";
import { formatRupees } from "@/lib/utils";
import { Podium } from "./podium";

/**
 * Prize pool. The headline figure and whether it is final both come from
 * `config/site.ts`; while `prize.approximate` is true the figure is labelled
 * as awaiting confirmation. Podium amounts appear once `prize.distribution`
 * is filled in.
 */
export function PrizeSection() {
  const { prize } = siteConfig;
  const extraTiers = prize.distribution?.slice(3) ?? [];

  return (
    <section
      id="prizes"
      aria-labelledby="prize-heading"
      className="relative isolate overflow-hidden border-y border-line bg-bg-soft"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {/* Spotlight cone from above, and slow orbit rings behind the figure. */}
        <div className="absolute inset-x-0 top-0 h-[70%] bg-[conic-gradient(from_180deg_at_50%_0%,transparent_40%,#c8ff2e14_47%,#ffffff1c_50%,#c8ff2e14_53%,transparent_60%)]" />
        <div className="absolute top-[38%] left-1/2 h-56 w-[70rem] max-w-none -translate-1/2 rounded-[100%] bg-[radial-gradient(closest-side,#c8ff2e1f,transparent)]" />
        <svg
          viewBox="0 0 800 800"
          className="absolute top-[38%] left-1/2 size-[62rem] max-w-none -translate-1/2 animate-spin-slow opacity-50"
        >
          <circle
            cx="400"
            cy="400"
            r="250"
            fill="none"
            stroke="#ffffff26"
            strokeDasharray="2 10"
          />
          <circle
            cx="400"
            cy="400"
            r="330"
            fill="none"
            stroke="#ffffff1c"
            strokeDasharray="1 14"
          />
          <circle cx="400" cy="400" r="399" fill="none" stroke="#ffffff12" />
          <circle cx="650" cy="400" r="4" fill="#c8ff2e" />
          <circle cx="400" cy="70" r="3" fill="#7fe9ff" />
        </svg>
      </div>

      <div className="container-page pt-24 text-center sm:pt-32">
        <Reveal>
          <p className="flex items-center justify-center gap-3 eyebrow text-lime">
            <span aria-hidden="true" className="text-subtle">
              02
            </span>
            <span aria-hidden="true" className="h-px w-8 bg-lime/60" />
            Prize pool
          </p>
          <h2 id="prize-heading" className="sr-only">
            Prize pool: {prize.approximate ? "approximately " : ""}
            {formatRupees(prize.total)}
          </h2>
          <p
            aria-hidden="true"
            className="mt-6 text-metal display text-[25vw] leading-[0.85] lg:text-[17rem]"
          >
            <Counter value={prize.total} prefix="₹" />
          </p>
          <p className="mt-6 text-lg text-muted">
            {prize.approximate ? "Approximate total" : "Total"} prize pool
            across all competitions
          </p>
          {prize.approximate && (
            <p className="mt-4">
              <Badge tone="warn" dot>
                Final amount awaiting organizer confirmation
              </Badge>
            </p>
          )}
        </Reveal>

        <div className="mt-16 sm:mt-20">
          <Podium tiers={prize.distribution} />
        </div>
      </div>

      <div className="border-t border-line-strong bg-bg">
        <div className="container-page grid gap-8 py-10 text-left md:grid-cols-2">
          <Reveal>
            <h3 className="eyebrow text-subtle">Distribution</h3>
            {prize.distribution ? (
              extraTiers.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-sm text-muted">
                  {extraTiers.map((tier) => (
                    <li key={tier.label} className="flex justify-between gap-4">
                      <span>{tier.label}</span>
                      <span className="text-fg">
                        {formatRupees(tier.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  The podium above shows the confirmed split.
                </p>
              )
            ) : (
              <>
                <p className="mt-3 font-medium text-fg">
                  Distribution to be announced
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {prize.distributionNote}
                </p>
              </>
            )}
          </Reveal>
          <Reveal delay={0.08}>
            <h3 className="eyebrow text-subtle">Prize eligibility</h3>
            {prize.eligibility ? (
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                {prize.eligibility.map((rule) => (
                  <li key={rule} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 bg-lime"
                    />
                    {rule}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Prize eligibility rules have not been published yet. Prizes are
                awarded at the organizers&apos; discretion once they are.
              </p>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
