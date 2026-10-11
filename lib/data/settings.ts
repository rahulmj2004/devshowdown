import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { SiteSettings } from "@/types";
import { CACHE_TAGS } from "./tags";

const settingsRowSchema = z.object({
  registration_status: z.enum(["not_open", "open", "closed"]),
  announcement_label: z.string(),
  announcement_text: z.string(),
});

function configSettings(): SiteSettings {
  return {
    registrationStatus:
      env.REGISTRATION_STATUS ?? siteConfig.defaults.registrationStatus,
    announcementLabel: siteConfig.defaults.announcementLabel,
    announcementText: siteConfig.defaults.announcementText,
    source: "config",
  };
}

/**
 * Runtime site settings. Reads the single `site_settings` row when Supabase is
 * connected and falls back to `config/site.ts` otherwise, or if the read fails.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  cacheLife("minutes");

  const supabase = createPublicClient();
  if (!supabase) return configSettings();

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("registration_status, announcement_label, announcement_text")
      .limit(1)
      .maybeSingle();
    if (error || !data) return configSettings();

    const row = settingsRowSchema.parse(data);
    return {
      registrationStatus: row.registration_status,
      announcementLabel: row.announcement_label,
      announcementText: row.announcement_text,
      source: "database",
    };
  } catch {
    return configSettings();
  }
}
