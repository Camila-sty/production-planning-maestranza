"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Loader2, AlertCircle } from "lucide-react";

type PageState = "loading" | "ready" | "invalid_link" | "success";

function translateUpdateError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  }
  if (msg.includes("same password") || msg.includes("different from")) {
    return "La nueva contraseña debe ser diferente a la actual.";
  }
  if (msg.includes("session") || msg.includes("not authenticated")) {
    return "Sesión inválida o expirada. Solicita un nuevo enlace de recuperación.";
  }
  return "Ocurrió un error al actualizar la contraseña. Intenta nuevamente.";
}

// Inner component that reads search params (must be inside Suspense)
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // If the callback route detected an invalid/expired code it appends ?error=link_invalido
    if (searchParams.get("error") === "link_invalido") {
      setPageState("invalid_link");
      return;
    }

    // Check for a valid session (set by /auth/callback after code exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPageState(session ? "ready" : "invalid_link");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(translateUpdateError(updateError.message));
      return;
    }

    setPageState("success");
    setTimeout(() => router.push("/auth/login"), 3000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">

        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            pageState === "invalid_link"
              ? "bg-red-500/10 border border-red-500/30"
              : "bg-amber-500/10 border border-amber-500/30"
          }`}>
            {pageState === "loading" && (
              <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
            )}
            {pageState === "invalid_link" && (
              <AlertCircle className="w-6 h-6 text-red-400" />
            )}
            {(pageState === "ready" || pageState === "success") && (
              <KeyRound className="w-6 h-6 text-amber-400" />
            )}
          </div>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {pageState === "loading" && (
          <p className="text-sm text-zinc-600 text-center">Verificando enlace…</p>
        )}

        {/* ── Invalid / expired link ─────────────────────────────────────────── */}
        {pageState === "invalid_link" && (
          <>
            <h1 className="text-xl font-semibold text-white text-center mb-2">
              Enlace inválido o expirado
            </h1>
            <p className="text-sm text-zinc-500 text-center mb-8">
              Este enlace de recuperación ya no es válido. Los enlaces expiran
              después de 1 hora.
            </p>
            <a
              href="/auth/login"
              className="block w-full text-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-medium py-2.5 transition-colors"
            >
              Solicitar nuevo enlace
            </a>
          </>
        )}

        {/* ── Success ───────────────────────────────────────────────────────── */}
        {pageState === "success" && (
          <>
            <h1 className="text-xl font-semibold text-white text-center mb-4">
              Contraseña actualizada
            </h1>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-400 text-center space-y-1">
              <p className="font-medium">Contraseña actualizada correctamente.</p>
              <p className="text-emerald-500/70">Ya puedes iniciar sesión. Redirigiendo…</p>
            </div>
          </>
        )}

        {/* ── Form ──────────────────────────────────────────────────────────── */}
        {pageState === "ready" && (
          <>
            <h1 className="text-xl font-semibold text-white text-center mb-1">
              Nueva contraseña
            </h1>
            <p className="text-sm text-zinc-500 text-center mb-8">
              Elige una contraseña segura para tu cuenta.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-zinc-300 text-sm">
                  Nueva contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/60 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-zinc-300 text-sm">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/60"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold disabled:opacity-40"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Actualizando…</>
                  : "Actualizar contraseña"
                }
              </Button>

              <p className="text-center">
                <a
                  href="/auth/login"
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Volver al inicio de sesión
                </a>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
