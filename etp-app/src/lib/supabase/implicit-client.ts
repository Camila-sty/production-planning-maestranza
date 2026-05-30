"use client";

/**
 * Implicit-flow Supabase client — used exclusively for password recovery.
 *
 * Why not createBrowserClient from @supabase/ssr?
 *   createBrowserClient hardcodes flowType:"pkce" and cannot be overridden.
 *
 * With flowType:"implicit", resetPasswordForEmail sends a recovery link whose
 * tokens arrive in the URL hash (#access_token=...&type=recovery) instead of
 * as a ?code= query param requiring a PKCE verifier.
 *
 * This client is NOT used for normal login or registration — those continue to
 * use createBrowserClient (@/lib/supabase/client) so their sessions remain
 * readable by the server-side middleware.
 */

import { createClient } from "@supabase/supabase-js";

export function createImplicitClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
