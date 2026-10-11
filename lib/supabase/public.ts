import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Anonymous, cookie-less client for public reads (published results, site
 * settings). Row Level Security decides what it can see.
 */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
