import { logout } from "@/actions/auth";
import type { AppUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "@/components/layout/admin-nav";

interface Props {
  user: AppUser;
}

export function AppHeader({ user }: Props) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-4">

        {/* ── Brand ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="bg-white rounded-md px-2 py-1 shadow shadow-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logos/logo-etp-equipos.jpeg"
              alt="ETP Equipos"
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="w-px h-7 bg-zinc-700" />
          <div className="bg-white rounded-md px-2 py-1 shadow shadow-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logos/logo-centro-equipos.jpeg"
              alt="Centro Equipos"
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-white leading-none">
              Sistema de Planificación
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Producción de Equipos</p>
          </div>
        </div>

        {/* ── Admin nav (center) ─────────────────────────────────────────────── */}
        {user.isAdmin && (
          <div className="flex-1 flex justify-start pl-2">
            <AdminNav />
          </div>
        )}

        {/* ── User actions (right) ───────────────────────────────────────────── */}
        <div className={`flex items-center gap-2 ${user.isAdmin ? "" : "ml-auto"}`}>
          <span className="text-xs text-zinc-500 hidden md:block">{user.email}</span>
          {user.isAdmin && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 hidden sm:block">
              Admin
            </span>
          )}
          <ThemeToggle />
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-white hover:bg-zinc-800 text-xs"
            >
              Cerrar sesión
            </Button>
          </form>
        </div>

      </div>
    </header>
  );
}
