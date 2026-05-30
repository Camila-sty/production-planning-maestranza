import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // No explicit cookieOptions — DEFAULT_COOKIE_OPTIONS (path="/", sameSite="lax",
      // no Secure) ensures the cookie works on both HTTP dev and HTTPS production.
      // Adding secure:true caused silent Set-Cookie failures in some contexts.
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}
