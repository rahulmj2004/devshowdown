import { Tba } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/config/site";
import { formatRupees } from "@/lib/utils";
import type { EventConfig } from "@/types";
import { HeroTerminal } from "./hero-terminal";

export function AboutSection({ events }: { events: readonly EventConfig[] }) {
  const { details, prize, skills } = siteConfig;
  const facts = [
    { label: "Dates", value: details.dates },
    { label: "Venue", value: details.venue },
    { label: "Registration deadline", value: details.registrationDeadline },
    { label: "Organized by", value: details.organizer },
  ];

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="border-t border-line bg-bg-soft"
    >
      <div className="container-page py-24 sm:py-32">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <SectionHeading
              id="about-heading"
              index="05"
              eyebrow="About DevShowdown"
              title="One event, many ways to win"
            />
            <Reveal className="mt-8 max-w-xl space-y-4 text-base leading-relaxed text-muted sm:text-lg">
              {siteConfig.about.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Reveal>

            <Reveal delay={0.08}>
              <dl className="mt-10 divide-y divide-line border-y border-line">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-center justify-between gap-4 py-3.5 text-sm"
                  >
                    <dt className="eyebrow text-subtle">{fact.label}</dt>
                    <dd className="text-right text-fg">
                      {fact.value ?? <Tba label="To be announced" />}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="lg:pt-10">
            <HeroTerminal
              events={events}
              prizeLabel={formatRupees(prize.total)}
              prizeApproximate={prize.approximate}
            />
          </Reveal>
        </div>

        {/* What the competitions are built to test. */}
        <ul className="mt-20 grid border-t border-line-strong sm:grid-cols-2 lg:grid-cols-5">
          {skills.map((skill, index) => (
            <li
              key={skill.title}
              className="border-b border-line py-7 sm:px-6 sm:odd:border-r lg:border-r lg:border-b-0 lg:first:pl-0 lg:last:border-r-0"
            >
              <Reveal delay={(index % 5) * 0.06}>
                <p aria-hidden="true" className="font-mono text-xs text-lime">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 display text-2xl text-fg">{skill.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {skill.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
