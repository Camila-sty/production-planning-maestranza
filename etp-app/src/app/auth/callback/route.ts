import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase PKCE auth callback.
 *
 * Supabase redirects here after the user clicks any auth email link.
 * Possible cases:
 *   ?code=xxx&next=/auth/reset-password   → exchange code → redirect to next
 *   ?error=access_denied&error_code=...   → OTP expired / invalid → redirect to login
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const error     = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const code      = searchParams.get("code");
  const next      = searchParams.get("next") ?? "/";

  // Supabase itself reported an error (e.g. otp_expired, access_denied)
  if (error) {
    const isExpired = errorCode === "otp_expired";
    const msg = isExpired ? "link_expirado" : "link_invalido";
    return NextResponse.redirect(`${origin}/auth/login?error=${msg}`);
  }

  // Exchange the PKCE code for a session (server-side, no PKCE verifier needed)
  if (code) {
    const supabase = await createClient();
    const { error: exchError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Exchange failed (code already used, network error, etc.)
    return NextResponse.redirect(`${origin}/auth/login?error=link_invalido`);
  }

  // No code and no error — unexpected, send to login
  return NextResponse.redirect(`${origin}/auth/login`);
}
