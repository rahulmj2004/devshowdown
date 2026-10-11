import type { Metadata } from "next";
import { Suspense } from "react";
import { getEventBySlug, getEventSlugs } from "@/config/events";
import { EventDetails, EventDetailsSkeleton } from "./event-details";

export function generateStaticParams() {
  return getEventSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return { title: "Event not found" };

  return {
    title: event.title,
    description: event.summary,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: `${event.title} · DevShowdown`,
      description: event.summary,
      url: `/events/${event.slug}`,
    },
  };
}

export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<EventDetailsSkeleton />}>
      <EventDetails params={params} />
    </Suspense>
  );
}
