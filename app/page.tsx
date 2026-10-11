import { Intro } from "@/components/hero/intro";
import { HackerRunner } from "@/components/runner/hacker-runner";
import { AboutSection } from "@/components/sections/about-section";
import { CoordinatorsSection } from "@/components/sections/coordinators-section";
import { EventsSection } from "@/components/sections/events-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { LeaderboardPreview } from "@/components/sections/leaderboard-preview";
import { Marquee } from "@/components/sections/marquee";
import { PrizeSection } from "@/components/sections/prize-section";
import { ScheduleSection } from "@/components/sections/schedule-section";
import { getEvents } from "@/config/events";
import { getPublishedResults } from "@/lib/data/results";
import { getSiteSettings } from "@/lib/data/settings";

export default async function HomePage() {
  const [settings, published] = await Promise.all([
    getSiteSettings(),
    getPublishedResults(),
  ]);
  const events = getEvents();

  // The leaderboard teaser is absent until results are published, so the
  // sections after it are numbered to match what actually renders.
  const after = published.entries.length > 0 ? 7 : 6;
  const number = (offset: number) => String(after + offset).padStart(2, "0");

  return (
    <>
      <Intro />
      <Hero settings={settings} events={events} />
      <Marquee items={events.map((event) => event.title)} />
      <EventsSection events={events} />
      <PrizeSection />
      <HowItWorks />
      <ScheduleSection />
      <AboutSection events={events} />
      <LeaderboardPreview entries={published.entries} index="06" />
      <FaqSection index={number(0)} />
      <CoordinatorsSection index={number(1)} />
      <FinalCta registrationStatus={settings.registrationStatus} />
      <HackerRunner />
    </>
  );
}
