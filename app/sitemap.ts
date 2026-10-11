import type { MetadataRoute } from "next";
import { getEventSlugs } from "@/config/events";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/events",
    ...getEventSlugs().map((slug) => `/events/${slug}`),
    "/register",
    "/leaderboard",
    "/rules",
    "/privacy",
    "/terms",
  ];
  return paths.map((path) => ({ url: `${siteUrl}${path}` }));
}
