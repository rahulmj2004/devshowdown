import { ArrowDownRight, ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Countdown } from "@/components/hero/countdown";
import { DragonFire } from "@/components/hero/dragon-fire";
import { HeroCore } from "@/components/hero/hero-core";
import { ParallaxLayer, PointerLight } from "@/components/hero/hero-layers";
import { Magnetic } from "@/components/motion/magnetic";
import { Tba } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn, formatRupees } from "@/lib/utils";
import type { EventConfig, SiteSettings } from "@/types";

/** Entrance step for `.hero-in`, counted from the end of the wordmark. */
const step = (index: number): CSSProperties =>
  ({ "--d": `${0.36 + index * 0.08}s` }) as CSSProperties;

function Characters({
  text,
  offset,
  className,
}: {
  text: string;
  offset: number;
  className?: string;
}) {
  return [...text].map((character, index) => (
    <span key={index} data-ember className="char-mask ember">
      <span
        className={cn("char", className)}
        style={{ "--i": offset + index } as CSSProperties}
      >
        {character}
      </span>
    </span>
  ));
}

export function Hero({
  settings,
  events,
}: {
  settings: SiteSettings;
  events: readonly EventConfig[];
}) {
  const { prize, details, headline } = siteConfig;
  const registrationOpen = settings.registrationStatus === "open";

  const facts = [
    { label: "Date", value: details.dates },
    { label: "Venue", value: details.venue },
  ];

  return (
    <section
      id="top"
      aria-label="DevShowdown"
      className="relative isolate -mt-16 flex min-h-svh flex-col overflow-hidden"
    >
      {/* ------------------------------------------------ background layers */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 animate-grid-pan bg-grid" />
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_78%_30%,#7b3dff2e,transparent_70%)]" />
        {/* Lightning, drawn by the dragon scene (see DragonFire). */}
        <canvas data-storm-sky className="absolute inset-0 size-full" />
        <PointerLight />
        <ParallaxLayer
          speed={0.22}
          className="absolute top-[-2%] left-1/2 aspect-square w-[135vw] -translate-x-1/2 opacity-50 sm:w-[90vw] lg:top-[-6%] lg:right-[-10%] lg:left-auto lg:w-[min(108vh,66rem)] lg:translate-x-0 lg:opacity-100"
        >
          <HeroCore className="size-full" />
        </ParallaxLayer>
        <div className="absolute inset-0 bg-scanlines opacity-25" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-b from-transparent to-bg" />
      </div>

      <div className="container-page flex flex-1 flex-col justify-end pt-24 pb-10 sm:pb-14">
        {/* ------------------------------------------------- annotation row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className="hero-in inline-flex max-w-full items-center gap-2.5 border border-line-strong bg-bg/60 py-1 pr-3.5 pl-1 text-xs text-muted backdrop-blur-sm"
            style={step(-5)}
          >
            <span className="bg-lime px-2 py-1 font-mono text-[10px] font-medium tracking-wider text-[#060608] uppercase">
              {settings.announcementLabel}
            </span>
            <span className="truncate">{settings.announcementText}</span>
          </p>
          <p
            aria-hidden="true"
            className="hero-in hidden eyebrow text-subtle md:block"
            style={step(-4)}
          >
            [ {String(events.length).padStart(2, "0")} competitions / one arena
            ]
          </p>
        </div>

        {/* ------------------------------------------------------- wordmark */}
        <ParallaxLayer speed={-0.07} className="mt-6 sm:mt-8">
          <h1
            data-fire-wordmark
            className="display text-[20.5vw] leading-[0.84] text-fg lg:text-[min(14.9vw,13.6rem)] lg:whitespace-nowrap"
          >
            <span className="sr-only">DevShowdown</span>
            <span aria-hidden="true" className="block lg:inline">
              <Characters
                text="DEV"
                offset={0}
                className="ember-stroke text-outline [-webkit-text-stroke-width:2px]"
              />
            </span>
            <span aria-hidden="true" className="block lg:inline">
              <Characters text="SHOWDOWN" offset={3} className="ember-fill" />
            </span>
          </h1>
        </ParallaxLayer>

        <div
          aria-hidden="true"
          className="hero-line mt-6 h-px w-full bg-line-strong sm:mt-8"
          style={{ "--d": "0.25s" } as CSSProperties}
        />

        {/* ------------------------------------------------------ lower row */}
        <div className="mt-6 grid gap-10 sm:mt-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16">
          <div className="min-w-0">
            <p
              className="hero-in display text-4xl text-fg sm:text-5xl lg:text-6xl"
              style={step(0)}
            >
              {headline.slice(0, -1).join(" ")}{" "}
              <span className="text-lime">{headline.at(-1)}</span>
            </p>
            <p
              className="hero-in mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg"
              style={step(1)}
            >
              <span className="text-fg">{siteConfig.tagline}</span>{" "}
              {siteConfig.heroCopy}
            </p>
            <div
              className="hero-in mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={step(2)}
            >
              <Magnetic>
                <ButtonLink
                  href="/register"
                  size="lg"
                  className="group w-full sm:w-auto"
                >
                  {registrationOpen ? "Register Now" : "Registration"}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  />
                </ButtonLink>
              </Magnetic>
              <ButtonLink
                href="/#events"
                size="lg"
                variant="secondary"
                className="group"
              >
                Explore Events
                <ArrowDownRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5"
                />
              </ButtonLink>
            </div>
          </div>

          <div className="hero-in min-w-0" style={step(3)}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border border-line bg-bg/70 p-5 backdrop-blur-md sm:p-6">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="eyebrow text-subtle">{fact.label}</dt>
                  <dd className="mt-1.5 text-sm text-fg sm:text-base">
                    {fact.value ?? <Tba label="To be announced" />}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="eyebrow text-subtle">Prize pool</dt>
                <dd className="mt-1 flex items-baseline gap-2">
                  <span className="display text-4xl text-lime sm:text-5xl">
                    {formatRupees(prize.total)}
                  </span>
                  {prize.approximate && (
                    <span className="font-mono text-[11px] text-subtle">
                      approx.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-subtle">Competitions</dt>
                <dd className="mt-1 display text-4xl text-fg sm:text-5xl">
                  {String(events.length).padStart(2, "0")}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="sr-only">Countdown</dt>
                <dd>
                  <Countdown startsAt={details.startsAt} />
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* The dragon flies over the content but never takes input. */}
      <DragonFire className="pointer-events-none absolute inset-0 z-10 size-full" />

      {/* ---------------------------------------------------- scroll cue */}
      <a
        href="#events"
        className="hero-in absolute right-2 bottom-10 hidden flex-col items-center gap-3 rounded-sm p-1 text-subtle transition-colors hover:text-lime xl:flex"
        style={step(5)}
      >
        <span className="eyebrow [writing-mode:vertical-rl]">Scroll</span>
        <span
          aria-hidden="true"
          className="relative block h-14 w-px overflow-hidden bg-line-strong"
        >
          <span className="absolute inset-0 animate-scroll-cue bg-lime" />
        </span>
        <span className="sr-only">to the competitions</span>
      </a>
    </section>
  );
}
