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

  // ── DIAGNOSTIC LOGS (temporary) ──────────────────────────────────────────
  console.log("[callback] full URL:", request.url);
  console.log("[callback] searchParams:", Object.fromEntries(searchParams.entries()));

  // Log cookie names present (no values — sensitive data)
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  console.log("[callback] cookies present:", cookieNames);
  const hasVerifier = cookieNames.some((n) => n.includes("code-verifier"));
  console.log("[callback] code-verifier cookie found:", hasVerifier);
  // ─────────────────────────────────────────────────────────────────────────

  const error     = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const code      = searchParams.get("code");
  const next      = searchParams.get("next") ?? "/";

  // Supabase itself reported an error (e.g. otp_expired, access_denied)
  if (error) {
    console.log("[callback] Supabase error:", error, errorCode);
    const isExpired = errorCode === "otp_expired";
    const msg = isExpired ? "otp_expirado" : "link_invalido";
    return NextResponse.redirect(`${origin}/auth/login?error=${msg}`);
  }

  // Exchange the PKCE code for a session (server-side)
  if (code) {
    console.log("[callback] code present, calling exchangeCodeForSession...");
    const supabase = await createClient();
    const { error: exchError } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[callback] exchangeCodeForSession error:", exchError?.message ?? "none");
    console.log("[callback] exchangeCodeForSession error name:", exchError?.name ?? "none");
    if (!exchError) {
      console.log("[callback] success — redirecting to:", next);
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/auth/login?error=otro_navegador`);
  }

  // No code and no error — unexpected, send to login
  console.log("[callback] no code and no error — unexpected");
  return NextResponse.redirect(`${origin}/auth/login`);
}
