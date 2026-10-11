import { Intro } from "@/components/hero/intro";
import { AboutSection } from "@/components/sections/about-section";
import { EventsSection } from "@/components/sections/events-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { LeaderboardPreview } from "@/components/sections/leaderboard-preview";
import { Marquee } from "@/components/sections/marquee";
import { PrizeSection } from "@/components/sections/prize-section";
import { ScheduleSection } from "@/components/sections/schedule-section";
import { SponsorsSection } from "@/components/sections/sponsors-section";
import { getEvents } from "@/config/events";
import { getPublishedResults } from "@/lib/data/results";
import { getSiteSettings } from "@/lib/data/settings";

export default async function HomePage() {
  const [settings, published] = await Promise.all([
    getSiteSettings(),
    getPublishedResults(),
  ]);
  const events = getEvents();

  return (
    <>
      <Intro />
      <Hero settings={settings} events={events} />
      <Marquee items={events.map((event) => event.title)} />
      <EventsSection
        events={events}
        registrationStatus={settings.registrationStatus}
      />
      <PrizeSection />
      <HowItWorks />
      <ScheduleSection />
      <AboutSection events={events} />
      <SponsorsSection />
      <LeaderboardPreview entries={published.entries} />
      <FaqSection />
      <FinalCta registrationStatus={settings.registrationStatus} />
    </>
  );
}
