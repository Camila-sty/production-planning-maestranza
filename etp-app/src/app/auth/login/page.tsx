import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

const equipoImages = [
  "/images/equipos/equipo-1.jpeg",
  "/images/equipos/equipo-2.jpeg",
  "/images/equipos/equipo-3.jpeg",
  "/images/equipos/equipo-4.jpeg",
  "/images/equipos/equipo-5.jpeg",
  "/images/equipos/equipo-6.jpeg",
];

const ERROR_MESSAGES: Record<string, string> = {
  cuenta_eliminada: "Tu usuario fue desactivado. Contacta al administrador.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const isDev = process.env.DEV_AUTH === "true";
  const allowRegister = process.env.ALLOW_PUBLIC_REGISTER !== "false";
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || undefined;

  const errorKey = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? undefined) : undefined;

  return (
    <div className="min-h-screen flex bg-zinc-950">

      {/* ── LEFT PANEL: equipment collage ───────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">

        {/* 2-col × 3-row image grid */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-px bg-zinc-900">
          {equipoImages.map((src, i) => (
            <div key={i} className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-zinc-950/30" />
            </div>
          ))}
        </div>

        {/* right-edge gradient to blend into auth panel */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-950 pointer-events-none" />
        {/* bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-zinc-950/50 pointer-events-none" />

        {/* logos + tagline at bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white rounded-lg px-3 py-2 shadow-xl shadow-black/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logos/logo-etp-equipos.jpeg"
                alt="ETP Equipos"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="bg-white rounded-lg px-3 py-2 shadow-xl shadow-black/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logos/logo-centro-equipos.jpeg"
                alt="Centro Equipos"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-2 drop-shadow-lg">
            Sistema de Planificación
            <br />
            <span className="text-amber-400">de Producción</span>
          </h1>
          <p className="text-zinc-400 text-sm">
            Gestión integral de equipos y talleres
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL: full-height auth panel ─────────────────── */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col bg-zinc-950 relative z-10 border-l border-zinc-800/60">
        <AuthForm isDev={isDev} allowRegister={allowRegister} errorMessage={errorMessage} adminEmail={adminEmail} />
      </div>

    </div>
  );
}
