"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Loader2, AlertCircle } from "lucide-react";

// ── Inner component — reads search params (requires Suspense boundary) ────────

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Verification state
  const [isVerifying, setIsVerifying] = useState(true);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Exchange the ?code= for a session — runs once on mount
  useEffect(() => {
    async function verify() {
      const code = searchParams.get("code");

      if (!code) {
        setLinkError("Falta el código de recuperación. Solicita un nuevo enlace.");
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setLinkError("El enlace de recuperación no es válido o expiró. Solicita uno nuevo.");
        } else {
          setIsRecoveryReady(true);
        }
      } catch {
        setLinkError("El enlace de recuperación no es válido o expiró. Solicita uno nuevo.");
      } finally {
        setIsVerifying(false);
      }
    }

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("same password") || msg.includes("different from")) {
          setFormError("La nueva contraseña debe ser diferente a la anterior.");
        } else if (msg.includes("rate limit") || msg.includes("too many")) {
          setFormError("Demasiados intentos. Espera unos minutos.");
        } else {
          setFormError("Ocurrió un error al actualizar la contraseña. Intenta nuevamente.");
        }
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch {
      setFormError("Error de red. Verifica tu conexión e intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // Button is disabled while verifying, no valid session, or form is incomplete/invalid
  const canSubmit =
    !isVerifying &&
    isRecoveryReady &&
    password.length >= 6 &&
    confirm.length >= 6 &&
    password === confirm &&
    !submitting;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
          <p className="text-sm text-zinc-600">Verificando enlace…</p>
        </div>
      </div>
    );
  }

  // ── Invalid / expired link ─────────────────────────────────────────────────
  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">
            Enlace inválido o expirado
          </h1>
          <p className="text-sm text-zinc-500 mb-8">{linkError}</p>
          <a
            href="/auth/login"
            className="block w-full text-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-medium py-2.5 transition-colors"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-white mb-4">
            Contraseña actualizada
          </h1>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-400 space-y-1.5">
            <p className="font-medium">Contraseña actualizada correctamente.</p>
            <p className="text-emerald-500/70">Redirigiendo al inicio de sesión…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">

        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-white text-center mb-1">
          Nueva contraseña
        </h1>
        <p className="text-sm text-zinc-500 text-center mb-8">
          Elige una contraseña segura para tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password" className="text-zinc-300 text-sm">
              Nueva contraseña
            </Label>
            <div className="relative">
              <Input
                id="rp-password"
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
            <Label htmlFor="rp-confirm" className="text-zinc-300 text-sm">
              Confirmar contraseña
            </Label>
            <Input
              id="rp-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              required
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/60"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold disabled:opacity-40"
          >
            {submitting
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
      </div>
    </div>
  );
}

// ── Page export with Suspense boundary (required for useSearchParams) ─────────

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
