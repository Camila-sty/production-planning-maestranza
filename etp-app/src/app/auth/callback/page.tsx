"use client";

/**
 * PKCE callback page.
 *
 * createBrowserClient sets flowType:"pkce" and detectSessionInUrl:true.
 * On initialization the client automatically calls exchangeCodeForSession
 * when it detects ?code= in the URL (_initialize → _getSessionFromURL).
 *
 * We must NOT call exchangeCodeForSession manually — that would be a
 * second attempt after the code/verifier are already consumed, causing
 * AuthPKCECodeVerifierMissingError.
 *
 * Correct approach:
 *   1. await supabase.auth.initialize() — waits for the auto-exchange to finish
 *   2. getSession() — reads the result
 *   3. redirect to `next` if session exists, otherwise show diagnostic
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface DiagInfo {
  codePresent: boolean;
  next: string;
  sessionAfterInit: boolean;
  errorName: string;
  errorMessage: string;
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [diag, setDiag] = useState<DiagInfo | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/auth/reset-password";

      // Supabase forwarded an error directly (e.g. otp_expired)
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

      // Wait for the auto-exchange triggered by detectSessionInUrl to complete.
      // initializePromise is idempotent: if already done, returns immediately.
      await supabase.auth.initialize();

      const { data: { session }, error } = await supabase.auth.getSession();

      if (session) {
        router.replace(next);
      } else {
        setDiag({
          codePresent: true,
          next,
          sessionAfterInit: false,
          errorName: error?.name ?? "NoSession",
          errorMessage: error?.message ?? "No se pudo establecer la sesión desde el enlace de recuperación",
        });
      }
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (diag) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-lg font-semibold text-red-400">Error en callback — diagnóstico</h1>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ["code recibido", diag.codePresent ? "✓ sí" : "✗ no"],
                ["next", diag.next],
                ["sesión tras init", diag.sessionAfterInit ? "✓ sí" : "✗ no"],
                ["error.name", diag.errorName],
                ["error.message", diag.errorMessage],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-zinc-800">
                  <td className="py-2 pr-4 text-zinc-500 whitespace-nowrap align-top">{label}</td>
                  <td className="py-2 text-zinc-200 break-all font-mono">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a
            href="/auth/login"
            className="block text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors pt-2"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

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
