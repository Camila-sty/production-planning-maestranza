"use client";

/**
 * Client-side PKCE callback page.
 *
 * Why client-side?
 * The PKCE code_verifier is stored by createBrowserClient in document.cookie.
 * exchangeCodeForSession reads it from that same storage. If we ran this
 * server-side the cookie might not be available or might not match the
 * in-browser storage that generated the challenge.
 *
 * Flow:
 *   Supabase email link → /auth/callback?code=xxx&next=/auth/reset-password
 *   → this page exchanges the code in the browser → redirect to next
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/auth/reset-password";

      // Supabase itself forwarded an error (e.g. otp_expired)
      const supabaseError = searchParams.get("error");
      const errorCode     = searchParams.get("error_code");
      if (supabaseError) {
        const msg = errorCode === "otp_expired" ? "otp_expirado" : "link_invalido";
        router.replace(`/auth/login?error=${msg}`);
        return;
      }

      if (!code) {
        router.replace("/auth/login?error=link_invalido");
        return;
      }

      // Diagnostic: inspect verifier storage
      const verifierKey = `supabase.auth.token-code-verifier`;
      const verifierFromLS = typeof localStorage !== "undefined" ? localStorage.getItem(verifierKey) : null;
      const verifierFromCookie = typeof document !== "undefined"
        ? document.cookie.split(";").find(c => c.trim().startsWith(verifierKey))
        : null;
      console.log("[callback] code present:", !!code);
      console.log("[callback] next:", next);
      console.log("[callback] verifier in localStorage:", !!verifierFromLS);
      console.log("[callback] verifier in cookies:", !!verifierFromCookie);
      console.log("[callback] all cookies:", typeof document !== "undefined" ? document.cookie : "n/a");

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[callback] exchangeCodeForSession error — name:", error.name, "message:", error.message);
          router.replace("/auth/login?error=otro_navegador");
        } else {
          router.replace(next);
        }
      } catch (e) {
        console.error("[callback] unexpected error:", e);
        router.replace("/auth/login?error=otro_navegador");
      }
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
        <p className="text-sm text-zinc-600">Validando enlace de recuperación…</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
