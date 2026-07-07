"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { localLogin, localRegister } from "@/actions/auth";
import {
  localLoginSchema,
  localRegisterSchema,
  ALLOWED_EMAIL_DOMAINS,
  ADMIN_EMAIL_EXCEPTIONS,
  type LocalLoginInput,
  type LocalRegisterInput,
} from "@/lib/validations";

const DOMAIN_ERROR =
  "Solo se permiten correos corporativos con los dominios @equiposycamiones.cl, @pto.cl o @etpequipos.cl.";

function hasAllowedDomain(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if ((ADMIN_EMAIL_EXCEPTIONS as readonly string[]).includes(normalized)) return true;
  const domain = normalized.split("@")[1];
  return !!domain && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  isDev?: boolean;
  allowRegister?: boolean;
  errorMessage?: string;
  adminEmail?: string;
}

export function AuthForm({ isDev, allowRegister = true, errorMessage, adminEmail }: Props) {
  if (isDev) return <LocalAuthPanel allowRegister={allowRegister} adminEmail={adminEmail} />;
  return <SupabaseAuthPanel allowRegister={allowRegister} errorMessage={errorMessage} adminEmail={adminEmail} />;
}

// ── Shared logo strip ─────────────────────────────────────────────────────────

function LogoStrip() {
  return (
    <div className="flex items-center gap-3 mb-10">
      <div className="bg-white rounded-lg px-3 py-2 shadow-lg shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logos/logo-etp-equipos.jpeg"
          alt="ETP Equipos"
          className="h-10 w-auto object-contain"
        />
      </div>
      <div className="w-px h-10 bg-zinc-700" />
      <div className="bg-white rounded-lg px-3 py-2 shadow-lg shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logos/logo-centro-equipos.jpeg"
          alt="Centro Equipos"
          className="h-10 w-auto object-contain"
        />
      </div>
    </div>
  );
}

// ── Forgot-password static message ────────────────────────────────────────────

function ForgotMessage({ adminEmail, onBack }: { adminEmail?: string; onBack: () => void }) {
  return (
    <div className="max-w-sm space-y-4">
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-4 space-y-2">
        <p className="text-sm text-zinc-300 leading-relaxed">
          Para restablecer tu contraseña, comunícate con el administrador del sistema.
        </p>
        {adminEmail && (
          <p className="text-sm font-medium text-amber-400">
            Administrador: {adminEmail}
          </p>
        )}
      </div>
      <button
        onClick={onBack}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Volver al inicio de sesión
      </button>
    </div>
  );
}

// ── Local auth panel ──────────────────────────────────────────────────────────

function LocalAuthPanel({ allowRegister, adminEmail }: { allowRegister: boolean; adminEmail?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 xl:px-14 py-12">
        <LogoStrip />

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-1 leading-tight">
            Sistema de Planificación
            <br />
            <span className="text-amber-400">de Producción</span>
          </h2>
          <p className="text-zinc-500 text-sm mt-3">
            Gestión integral de equipos y talleres
          </p>
        </div>

        {/* Mode tabs — only shown when registration is allowed */}
        {allowRegister && (
          <div className="flex gap-1 mb-8 bg-zinc-800/60 rounded-lg p-1 w-fit">
            <button
              onClick={() => setMode("login")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode("register")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Crear usuario
            </button>
          </div>
        )}

        {mode === "login" || !allowRegister
          ? <LoginForm adminEmail={adminEmail} />
          : <RegisterForm />}
      </div>

      <p className="px-8 sm:px-12 xl:px-14 pb-8 text-xs text-zinc-700 text-center">
        ETP Equipos · Centro Equipos · Sistema interno de planificación
      </p>
    </div>
  );
}

function LoginForm({ adminEmail }: { adminEmail?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showForgot, setShowForgot]   = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LocalLoginInput>({
    resolver: zodResolver(localLoginSchema),
  });

  async function onSubmit(data: LocalLoginInput) {
    setServerError(null);
    const result = await localLogin(data.email, data.password);
    if (result.error) {
      setServerError(result.error);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  if (showForgot) {
    return <ForgotMessage adminEmail={adminEmail} onBack={() => setShowForgot(false)} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="email-login" className="text-zinc-300 text-sm">
          Correo electrónico
        </Label>
        <Input
          id="email-login"
          type="email"
          autoComplete="email"
          placeholder="usuario@empresa.cl"
          {...register("email")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password-login" className="text-zinc-300 text-sm">
            Contraseña
          </Label>
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <Input
          id="password-login"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
      >
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  );
}

function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LocalRegisterInput>({
    resolver: zodResolver(localRegisterSchema),
  });

  async function onSubmit(data: LocalRegisterInput) {
    setServerError(null);
    const result = await localRegister(data.email, data.password, data.name);
    if (result.error) {
      setServerError(result.error);
    } else {
      toast.success(`Cuenta creada. ¡Bienvenido!`);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="email-reg" className="text-zinc-300 text-sm">
          Correo electrónico
        </Label>
        <Input
          id="email-reg"
          type="email"
          autoComplete="email"
          placeholder="usuario@empresa.cl"
          {...register("email")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
        {!errors.email && (
          <p className="text-xs text-amber-400/80 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 leading-relaxed">
            Asegúrate de que este correo existe y tienes acceso a él. Si el correo no existe, no podrás iniciar sesión.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name-reg" className="text-zinc-300 text-sm">
          Nombre (opcional)
        </Label>
        <Input
          id="name-reg"
          autoComplete="name"
          placeholder="Tu nombre"
          {...register("name")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.name && (
          <p className="text-xs text-red-400">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password-reg" className="text-zinc-300 text-sm">
          Contraseña
        </Label>
        <Input
          id="password-reg"
          type="password"
          autoComplete="new-password"
          placeholder="mín. 6 caracteres"
          {...register("password")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-reg" className="text-zinc-300 text-sm">
          Confirmar contraseña
        </Label>
        <Input
          id="confirm-reg"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          {...register("confirmPassword")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-400">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
      >
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
    </form>
  );
}

// ── Supabase error translation ────────────────────────────────────────────────

function translateSupabaseError(message: string): string {
  const msg = message.toLowerCase();

  // Registration / email
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
    return "Este correo ya está registrado.";
  }
  if (msg.includes("unable to validate email") || msg.includes("invalid email") || msg.includes("valid email")) {
    return "El correo ingresado no es válido.";
  }
  if (msg.includes("email not confirmed")) {
    return "El correo no ha sido confirmado. Revisa tu bandeja de entrada y haz clic en el enlace de activación.";
  }
  if (msg.includes("email link is invalid") || msg.includes("token has expired") || msg.includes("otp expired")) {
    return "El enlace expiró o ya fue usado. Solicita uno nuevo.";
  }

  // Password
  if (msg.includes("password should be at least") || msg.includes("password must be at least") || msg.includes("password is too short")) {
    return "La contraseña es demasiado corta. Debe tener al menos 6 caracteres.";
  }
  if (msg.includes("password should contain") || msg.includes("weak password") || msg.includes("password is too weak")) {
    return "La contraseña es demasiado débil. Usa letras, números y caracteres especiales.";
  }

  // Login
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials") || msg.includes("wrong password")) {
    return "Correo o contraseña incorrectos.";
  }

  // Rate limits
  if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("request rate")) {
    return "Demasiados intentos. Espera unos minutos antes de intentarlo nuevamente.";
  }
  if (msg.includes("for security purposes") || msg.includes("only request this after")) {
    return "Por seguridad, espera unos segundos antes de intentarlo nuevamente.";
  }

  // Network / server
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch")) {
    return "Error de conexión. Verifica tu internet e intenta de nuevo.";
  }

  // Signup disabled
  if (msg.includes("signup is disabled") || msg.includes("signups not allowed")) {
    return "El registro está deshabilitado. Contacta al administrador.";
  }

  return message;
}

// ── Supabase auth panel (production) ─────────────────────────────────────────

function SupabaseAuthPanel({
  allowRegister,
  errorMessage,
  adminEmail,
}: {
  allowRegister: boolean;
  errorMessage?: string;
  adminEmail?: string;
}) {
  const [mode, setMode]         = useState<"login" | "signup">("login");
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setShowForgot(false);
    setServerError(null);
    setSuccessMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    if (mode === "signup" && !name.trim()) {
      setServerError("El nombre de usuario es obligatorio.");
      return;
    }

    setLoading(true);
    try {
      if (!hasAllowedDomain(email)) {
        setServerError(DOMAIN_ERROR);
        setLoading(false);
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setServerError(translateSupabaseError(error.message));
          return;
        }
        router.push("/");
        router.refresh();

      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) {
          setServerError(translateSupabaseError(error.message));
          return;
        }
        setSuccessMsg("Cuenta creada correctamente. Revisa tu correo para confirmar la cuenta.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password message ──────────────────────────────────────────────

  if (showForgot) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 xl:px-14 py-12">
          <LogoStrip />
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-1 leading-tight">
              Sistema de Planificación
              <br />
              <span className="text-amber-400">de Producción</span>
            </h2>
          </div>
          <ForgotMessage adminEmail={adminEmail} onBack={() => setShowForgot(false)} />
        </div>
        <p className="px-8 sm:px-12 xl:px-14 pb-8 text-xs text-zinc-700 text-center">
          ETP Equipos · Centro Equipos · Sistema interno de planificación
        </p>
      </div>
    );
  }

  // ── Login / Signup ────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 xl:px-14 py-12">
        <LogoStrip />

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-1 leading-tight">
            Sistema de Planificación
            <br />
            <span className="text-amber-400">de Producción</span>
          </h2>
          <p className="text-zinc-500 text-sm mt-3">
            Gestión integral de equipos y talleres
          </p>
        </div>

        {allowRegister && (
          <div className="flex gap-1 mb-8 bg-zinc-800/60 rounded-lg p-1 w-fit">
            <button
              onClick={() => switchMode("login")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => switchMode("signup")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {/* Error banner from redirect (e.g. session expired) */}
        {errorMessage && !successMsg && (
          <div className="mb-5 max-w-sm text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2.5">
            {errorMessage}
          </div>
        )}

        {/* Success banner (signup) */}
        {successMsg && (
          <div className="mb-5 max-w-sm text-sm text-green-400 bg-green-950/40 border border-green-900/50 rounded-lg px-3 py-2.5">
            {successMsg}
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
            {/* Name — signup only */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="supabase-name" className="text-zinc-300 text-sm">
                  Nombre de usuario
                </Label>
                <Input
                  id="supabase-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                  className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="supabase-email" className="text-zinc-300 text-sm">
                Correo electrónico
              </Label>
              <Input
                id="supabase-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.cl"
                required
                autoComplete="email"
                className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
              />
              {mode === "signup" && (
                <p className="text-xs text-amber-400/80 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 leading-relaxed">
                  Asegúrate de que este correo existe y tienes acceso a él. Recibirás un enlace de activación; si el correo no existe, no podrás iniciar sesión.
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="supabase-password" className="text-zinc-300 text-sm">
                  Contraseña
                </Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <Input
                id="supabase-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
              />
            </div>

            {/* Inline error */}
            {serverError && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
            >
              {loading
                ? "Cargando..."
                : mode === "login"
                ? "Ingresar"
                : "Crear cuenta"}
            </Button>
          </form>
        )}

        {successMsg && (
          <button
            onClick={() => switchMode("login")}
            className="mt-4 text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            Volver al inicio de sesión
          </button>
        )}
      </div>

      <p className="px-8 sm:px-12 xl:px-14 pb-8 text-xs text-zinc-700 text-center">
        ETP Equipos · Centro Equipos · Sistema interno de planificación
      </p>
    </div>
  );
}
