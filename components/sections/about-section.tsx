import { ArrowUpRight, MapPin } from "lucide-react";
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
          </div>

          <div className="lg:pt-10">
            <Reveal delay={0.1}>
              <HeroTerminal
                events={events}
                prizeLabel={formatRupees(prize.total)}
                prizeApproximate={prize.approximate}
              />
            </Reveal>
            <Reveal delay={0.16}>
              <dl className="mt-8 divide-y divide-line border-y border-line">
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
        </div>

        {details.venue && (
          <Reveal className="mt-20">
            <div
              id="venue"
              className="grid scroll-mt-24 border border-line bg-surface lg:grid-cols-[0.8fr_1.2fr]"
            >
              <div className="flex flex-col p-6 sm:p-8">
                <p className="flex items-center gap-2 eyebrow text-lime">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  Venue
                </p>
                <h3 className="mt-4 display text-3xl text-fg sm:text-4xl">
                  {details.venue}
                </h3>
                {details.venueAddress && (
                  <address className="mt-4 max-w-xs text-sm leading-relaxed text-muted not-italic">
                    {details.venueAddress}
                  </address>
                )}
                {details.venueMapUrl && (
                  <a
                    href={details.venueMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-8 inline-flex items-center gap-2 self-start rounded-[3px] border border-line-strong px-3.5 py-2 text-sm text-muted transition-colors duration-200 hover:border-lime hover:text-lime lg:mt-auto"
                  >
                    Get directions
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
              {details.venueMapEmbedUrl && (
                <iframe
                  src={details.venueMapEmbedUrl}
                  title={`Map showing ${details.venue}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  // Google's embed has no dark theme, so the tiles are inverted to
                  // sit in the page. Hovering restores the original colours.
                  className="h-72 w-full border-t border-line [filter:invert(0.92)_hue-rotate(180deg)_saturate(0.7)_brightness(0.95)_contrast(0.9)] transition-[filter] duration-500 hover:[filter:none] lg:h-full lg:min-h-96 lg:border-t-0 lg:border-l"
                />
              )}
            </div>
          </Reveal>
        )}

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
