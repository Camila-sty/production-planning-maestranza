import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase PKCE auth callback.
 * Supabase redirects here with ?code=xxx after the user clicks any auth email
 * link (confirmation, password recovery, magic link).
 * We exchange the code for a session and redirect to ?next= (default: "/").
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed → go to reset-password page with error flag
  // so the user sees a clear "link expirado" message instead of a blank form.
  const target = next.startsWith("/auth/") ? next : "/auth/reset-password";
  return NextResponse.redirect(`${origin}${target}?error=link_invalido`);
}
