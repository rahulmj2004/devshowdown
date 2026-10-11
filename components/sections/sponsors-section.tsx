import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/config/site";
import type { Sponsor } from "@/types";

function SponsorTile({ sponsor }: { sponsor: Sponsor }) {
  const content = sponsor.logo ? (
    <span className="relative block h-12 w-full">
      <Image
        src={sponsor.logo}
        alt={sponsor.name}
        fill
        sizes="(min-width: 1024px) 14rem, 40vw"
        className="object-contain opacity-70 grayscale transition-[opacity,filter] duration-300 group-hover:opacity-100 group-hover:grayscale-0"
      />
    </span>
  ) : (
    <span className="display text-2xl text-muted transition-colors duration-300 group-hover:text-fg">
      {sponsor.name}
    </span>
  );

  const className =
    "group flex h-28 items-center justify-center border border-line bg-surface px-6 transition-colors duration-300 hover:border-line-strong";

  return sponsor.href ? (
    <a
      href={sponsor.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * Sponsor and partner wall, driven by `siteConfig.sponsors`. No sponsor is
 * ever shown unless it is configured; the empty state says so plainly.
 */
export function SponsorsSection() {
  const { sponsors, contact } = siteConfig;
  const hasSponsors = sponsors.some((tier) => tier.sponsors.length > 0);

  return (
    <section
      id="sponsors"
      aria-labelledby="sponsors-heading"
      className="container-page py-24 sm:py-32"
    >
      <SectionHeading
        id="sponsors-heading"
        index="06"
        eyebrow="Sponsors and partners"
        title="Backed by"
      />

      {hasSponsors ? (
        <div className="mt-14 space-y-12">
          {sponsors
            .filter((tier) => tier.sponsors.length > 0)
            .map((tier) => (
              <Reveal key={tier.tier}>
                <h3 className="eyebrow text-subtle">{tier.tier}</h3>
                <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {tier.sponsors.map((sponsor) => (
                    <li key={sponsor.name}>
                      <SponsorTile sponsor={sponsor} />
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
        </div>
      ) : (
        <Reveal className="mt-14">
          <div className="grid gap-px border border-line bg-line md:grid-cols-[1.2fr_1fr]">
            <div className="bg-bg p-8 sm:p-10">
              <p className="display text-3xl text-fg sm:text-4xl">
                Sponsors to be announced
              </p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                No sponsors or partners have been confirmed yet. They will be
                listed here, by tier, as soon as they are.
              </p>
              <p className="mt-6 text-sm text-muted">
                Interested in supporting the event?{" "}
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="rounded-sm text-fg underline underline-offset-4 hover:text-lime"
                  >
                    {contact.email}
                  </a>
                ) : (
                  "Organizer contact details will be published in the footer."
                )}
              </p>
            </div>
            <ul aria-hidden="true" className="grid grid-cols-2 gap-px bg-line">
              {Array.from({ length: 4 }, (_, index) => (
                <li
                  key={index}
                  className="flex h-28 items-center justify-center bg-bg bg-[repeating-linear-gradient(135deg,transparent_0_8px,#ffffff06_8px_9px)] font-mono text-[11px] text-subtle/60 md:h-auto"
                >
                  open slot
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}
    </section>
  );
}
