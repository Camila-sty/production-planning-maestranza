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
}

export function AuthForm({ isDev }: Props) {
  if (isDev) return <LocalAuthPanel />;
  return <SupabaseAuthPanel />;
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

function LocalAuthPanel() {
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

        {/* Mode tabs */}
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

        {mode === "login" ? <LoginForm /> : <RegisterForm />}
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

  async function onSubmit(data: LocalLoginInput) {
    setServerError(null);
    const result = await localLogin(data.username, data.password);
    if (result.error) {
      setServerError(result.error);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="username-login" className="text-zinc-300 text-sm">
          Usuario
        </Label>
        <Input
          id="username-login"
          autoComplete="username"
          placeholder="tu_usuario"
          {...register("username")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.username && (
          <p className="text-xs text-red-400">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password-login" className="text-zinc-300 text-sm">
          Contraseña
        </Label>
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
    const result = await localRegister(data.username, data.password);
    if (result.error) {
      setServerError(result.error);
    } else {
      toast.success(`Usuario "${data.username}" creado. ¡Bienvenido!`);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="username-reg" className="text-zinc-300 text-sm">
          Usuario
        </Label>
        <Input
          id="username-reg"
          autoComplete="username"
          placeholder="min. 3 caracteres"
          {...register("username")}
          className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
        />
        {errors.username && (
          <p className="text-xs text-red-400">{errors.username.message}</p>
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
        {isSubmitting ? "Creando usuario..." : "Crear usuario"}
      </Button>
    </form>
  );
}

// ── Supabase auth panel (production) ─────────────────────────────────────────

function SupabaseAuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Revisa tu correo para confirmar tu cuenta.");
        setMode("login");
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
            onClick={() => setMode("signup")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-zinc-300 text-sm">
              Correo
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.cl"
              required
              className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-zinc-300 text-sm">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-zinc-800/70 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500 h-11"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
          >
            {loading
              ? "Cargando..."
              : mode === "login"
              ? "Ingresar"
              : "Registrarse"}
          </Button>
        </form>
      </div>

      <p className="px-8 sm:px-12 xl:px-14 pb-8 text-xs text-zinc-700 text-center">
        ETP Equipos · Centro Equipos · Sistema interno de planificación
      </p>
    </div>
  );
}
