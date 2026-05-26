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
  type LocalLoginInput,
  type LocalRegisterInput,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  isDev?: boolean;
  allowRegister?: boolean;
}

export function AuthForm({ isDev, allowRegister = true }: Props) {
  if (isDev) return <LocalAuthPanel allowRegister={allowRegister} />;
  return <SupabaseAuthPanel allowRegister={allowRegister} />;
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

// ── Local auth panel ──────────────────────────────────────────────────────────

function LocalAuthPanel({ allowRegister }: { allowRegister: boolean }) {
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

        {mode === "login" || !allowRegister ? <LoginForm /> : <RegisterForm />}
      </div>

      <p className="px-8 sm:px-12 xl:px-14 pb-8 text-xs text-zinc-700 text-center">
        ETP Equipos · Centro Equipos · Sistema interno de planificación
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LocalLoginInput>({
    resolver: zodResolver(localLoginSchema),
  });

  const [forgotPassword, setForgotPassword] = useState(false);

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

  if (forgotPassword) {
    return (
      <div className="max-w-sm space-y-4">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Para restablecer tu contraseña, contacta al administrador del sistema.
        </p>
        <button
          onClick={() => setForgotPassword(false)}
          className="text-amber-400 hover:text-amber-300 text-sm underline underline-offset-2"
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
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
            onClick={() => setForgotPassword(true)}
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

// ── Supabase auth panel (production) ─────────────────────────────────────────

function SupabaseAuthPanel({ allowRegister }: { allowRegister: boolean }) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function switchMode(next: "login" | "signup" | "forgot") {
    setMode(next);
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
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setServerError("Correo o contraseña incorrectos.");
          return;
        }
        router.push("/");
        router.refresh();

      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
            setServerError("Este correo ya está registrado.");
          } else {
            setServerError(error.message);
          }
          return;
        }
        setSuccessMsg("Cuenta creada correctamente. Revisa tu correo para confirmar la cuenta.");

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) { setServerError(error.message); return; }
        setSuccessMsg("Revisa tu correo. Te enviamos un enlace para restablecer tu contraseña.");
      }
    } finally {
      setLoading(false);
    }
  }

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

        {allowRegister && mode !== "forgot" && (
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

        {/* Success banner (signup / forgot) */}
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
            </div>

            {/* Password — login and signup only */}
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supabase-password" className="text-zinc-300 text-sm">
                    Contraseña
                  </Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
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
            )}

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
                : mode === "signup"
                ? "Crear cuenta"
                : "Enviar enlace de recuperación"}
            </Button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            )}
          </form>
        )}

        {successMsg && mode !== "login" && (
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
