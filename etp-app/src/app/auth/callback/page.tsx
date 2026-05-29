"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface DiagInfo {
  codePresent: boolean;
  next: string;
  verifierInLS: boolean;
  verifierInCookie: boolean;
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

      const verifierKey = "supabase.auth.token-code-verifier";
      const verifierInLS =
        typeof localStorage !== "undefined" && !!localStorage.getItem(verifierKey);
      const verifierInCookie =
        typeof document !== "undefined" &&
        document.cookie.split(";").some((c) => c.trim().startsWith(verifierKey));

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setDiag({
            codePresent: true,
            next,
            verifierInLS,
            verifierInCookie,
            errorName: error.name,
            errorMessage: error.message,
          });
        } else {
          router.replace(next);
        }
      } catch (e) {
        const err = e as Error;
        setDiag({
          codePresent: true,
          next,
          verifierInLS,
          verifierInCookie,
          errorName: err?.name ?? "UnknownError",
          errorMessage: err?.message ?? String(e),
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
                ["code_verifier en localStorage", diag.verifierInLS ? "✓ sí" : "✗ no"],
                ["code_verifier en cookies", diag.verifierInCookie ? "✓ sí" : "✗ no"],
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
