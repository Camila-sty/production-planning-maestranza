"use client";

/**
 * Shared PKCE browser client.
 *
 * Used by both /auth/login (resetPasswordForEmail) and /auth/callback
 * (exchangeCodeForSession) so the code_verifier written in the login page
 * is readable in the callback page using the same storage format.
 *
 * Why not createBrowserClient from @supabase/ssr?
 *   createBrowserClient hardcodes detectSessionInUrl:isBrowser() and cannot
 *   be overridden. On /auth/callback that triggers an automatic exchange before
 *   our manual call, consuming the verifier and causing
 *   AuthPKCECodeVerifierMissingError on the second attempt.
 *
 * Storage format:
 *   Mirrors @supabase/ssr createBrowserClient exactly:
 *   - cookie name  : storageKey  (default "supabase.auth.token")
 *   - cookie value : "base64-" + stringToBase64URL(rawValue)
 *   - Max-Age      : 400 days
 *   - path=/; SameSite=Lax  (no Secure so it works on HTTP dev too)
 *
 * Compatibility:
 *   The session written here is readable by createBrowserClient (reset-password
 *   page) and by createServerClient (server components / middleware) because
 *   both decode the same "base64-…" cookie format.
 */

import { createClient } from "@supabase/supabase-js";
import { stringFromBase64URL, stringToBase64URL } from "@supabase/ssr";

// ── Cookie storage ────────────────────────────────────────────────────────────

const BASE64_PREFIX = "base64-";
const MAX_AGE       = 400 * 24 * 60 * 60; // 400 days (same as DEFAULT_COOKIE_OPTIONS)

export const VERIFIER_KEY = "supabase.auth.token-code-verifier";

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const out: Record<string, string> = {};
  for (const c of document.cookie.split(";")) {
    const idx = c.indexOf("=");
    if (idx < 0) continue;
    out[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
  }
  return out;
}

export const ssBrowserStorage = {
  getItem(key: string): string | null {
    const raw = parseCookies()[key];
    if (raw == null) return null;
    if (raw.startsWith(BASE64_PREFIX)) {
      return stringFromBase64URL(raw.slice(BASE64_PREFIX.length));
    }
    return raw;
  },

  setItem(key: string, value: string): void {
    if (typeof document === "undefined") return;
    const encoded = BASE64_PREFIX + stringToBase64URL(value);
    // No 'Secure' flag: let the browser default apply so the cookie works on
    // both HTTP (local dev) and HTTPS (production) without silent failure.
    document.cookie =
      `${key}=${encoded}; path=/; SameSite=Lax; Max-Age=${MAX_AGE}`;
  },

  removeItem(key: string): void {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=; path=/; SameSite=Lax; Max-Age=0`;
  },
};

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: ReturnType<typeof createClient> | null = null;

/**
 * Returns a singleton Supabase client configured for PKCE auth with
 * cookie-based storage and detectSessionInUrl:false so only a single
 * explicit exchangeCodeForSession call is made in the callback page.
 */
export function createPkceClient() {
  // During SSR the storage APIs are unavailable — return a plain client that
  // won't be used for auth operations (event handlers only fire in the browser).
  if (typeof window === "undefined") {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (_client) return _client;

  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        storage: ssBrowserStorage,
        storageKey: "supabase.auth.token",
        autoRefreshToken: true,
      },
    }
  );

  return _client;
}
