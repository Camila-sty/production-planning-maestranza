import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AppHeader } from "@/components/layout/app-header";
import { ThemedToaster } from "@/components/themed-toaster";
import { UsersPanel } from "@/components/admin/users-panel";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!user.isAdmin) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <ThemedToaster />
      <AppHeader user={user} />

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-amber-500 rounded-full" />
          <h2 className="text-base font-semibold text-white">Usuarios</h2>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 mb-4">
            Gestión de usuarios del sistema. Solo visible para administradores.
          </p>
          <UsersPanel currentUserId={user.id} />
        </div>
      </main>
    </div>
  );
}
