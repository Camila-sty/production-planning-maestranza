"use client";

/**
 * PKCE callback page — manual exchange, no detectSessionInUrl.
 *
 * createBrowserClient from @supabase/ssr hardcodes detectSessionInUrl:isBrowser()
 * which cannot be overridden. If we also call exchangeCodeForSession manually,
 * the auto-exchange runs first, consumes the code+verifier, and our call gets
 * AuthPKCECodeVerifierMissingError.
 *
 * Fix: use @supabase/supabase-js createClient directly with detectSessionInUrl:false
 * and a cookie storage adapter compatible with createBrowserClient's base64url
 * encoding so the verifier written on /auth/login is readable here.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { stringFromBase64URL, stringToBase64URL } from "@supabase/ssr";
import { Loader2 } from "lucide-react";

// ── Cookie storage compatible with @supabase/ssr createBrowserClient ──────────

const BASE64_PREFIX = "base64-";
const VERIFIER_KEY  = "supabase.auth.token-code-verifier";
const MAX_AGE       = 400 * 24 * 60 * 60; // 400 days

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const result: Record<string, string> = {};
  for (const c of document.cookie.split(";")) {
    const idx = c.indexOf("=");
    if (idx < 0) continue;
    result[c.slice(0, idx).trim()] = c.slice(idx + 1).trim();
  }
  return result;
}

const ssBrowserStorage = {
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
    document.cookie = `${key}=${encoded}; path=/; SameSite=lax; Secure; Max-Age=${MAX_AGE}`;
  },
  removeItem(key: string): void {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=; path=/; SameSite=lax; Secure; Max-Age=0`;
  },
};

/** One-off client with detectSessionInUrl:false — NOT the createBrowserClient singleton. */
function createCallbackClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        storage: ssBrowserStorage,
        storageKey: "supabase.auth.token",
        autoRefreshToken: false,
      },
    }
  );
}

// ── Diagnostic types ──────────────────────────────────────────────────────────

interface DiagInfo {
  codePresent: boolean;
  next: string;
  cookieNames: string[];
  verifierInCookie: boolean;
  verifierInLS: boolean;
  errorName: string;
  errorMessage: string;
}

// ── Callback content ──────────────────────────────────────────────────────────

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

      // Pre-exchange diagnostics
      const cookies       = parseCookies();
      const cookieNames   = Object.keys(cookies);
      const verifierInCookie = VERIFIER_KEY in cookies;
      const verifierInLS     =
        typeof localStorage !== "undefined" && !!localStorage.getItem(VERIFIER_KEY);

      const supabase = createCallbackClient();

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setDiag({ codePresent: true, next, cookieNames, verifierInCookie, verifierInLS,
            errorName: error.name, errorMessage: error.message });
        } else {
          router.replace(next);
        }
      } catch (e) {
        const err = e as Error;
        setDiag({ codePresent: true, next, cookieNames, verifierInCookie, verifierInLS,
          errorName: err?.name ?? "UnknownError", errorMessage: err?.message ?? String(e) });
      }
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (diag) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-lg space-y-4">
          <h1 className="text-lg font-semibold text-red-400">Error en callback — diagnóstico</h1>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {([
                ["code recibido",      diag.codePresent       ? "✓ sí" : "✗ no"],
                ["next",               diag.next],
                ["verifier en cookie", diag.verifierInCookie  ? "✓ sí" : "✗ no"],
                ["verifier en localStorage", diag.verifierInLS ? "✓ sí" : "✗ no"],
                ["cookies presentes",  diag.cookieNames.length > 0
                  ? diag.cookieNames.join(", ")
                  : "(ninguna)"],
                ["error.name",         diag.errorName],
                ["error.message",      diag.errorMessage],
              ] as [string, string][]).map(([label, value]) => (
                <tr key={label} className="border-b border-zinc-800">
                  <td className="py-2 pr-4 text-zinc-500 whitespace-nowrap align-top">{label}</td>
                  <td className="py-2 text-zinc-200 break-all font-mono text-xs">{value}</td>
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
