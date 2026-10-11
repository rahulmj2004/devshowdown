import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isRegistrationBackendConfigured } from "@/lib/env";

/**
 * Service-role client. It bypasses Row Level Security, so it must only be used
 * for narrowly scoped server-side writes (inserting a registration) and must
 * never be returned to, or imported from, client code.
 */
export function createServiceClient(): SupabaseClient | null {
  if (!isRegistrationBackendConfigured) return null;
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
