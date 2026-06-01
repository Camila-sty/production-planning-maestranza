"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, RefreshCw } from "lucide-react";
import type { AdminUser } from "@/app/api/admin/users/route";

export function UsersPanel() {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError,   setResetError]   = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? "Error al cargar usuarios.");
      } else {
        setUsers(data.users ?? []);
      }
    } catch {
      setFetchError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  function openReset(u: AdminUser) {
    setResetTarget(u);
    setNewPassword("");
    setConfirmPw("");
    setResetError(null);
    setResetSuccess(false);
  }

  function closeReset() {
    setResetTarget(null);
    setResetError(null);
    setResetSuccess(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 8) {
      setResetError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPw) {
      setResetError("Las contraseñas no coinciden.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget!.id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setResetError(data.error ?? "Error al actualizar la contraseña.");
      } else {
        setResetSuccess(true);
      }
    } catch {
      setResetError("Error de red.");
    } finally {
      setResetLoading(false);
    }
  }

  // ── Loading / error state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando usuarios…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {fetchError}
        </p>
        <Button variant="ghost" size="sm" onClick={loadUsers} className="text-zinc-400 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reintentar
        </Button>
      </div>
    );
  }

  // ── Table ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500">{users.length} usuario{users.length !== 1 ? "s" : ""}</p>
        <Button variant="ghost" size="sm" onClick={loadUsers} className="text-zinc-500 hover:text-white h-7 px-2">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Nombre</th>
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Correo</th>
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Rol</th>
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Estado</th>
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Creado</th>
              <th className="pb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="py-3 pr-4 text-zinc-300">{u.name ?? <span className="text-zinc-600 italic">—</span>}</td>
                <td className="py-3 pr-4 text-zinc-300 font-mono text-xs">{u.email}</td>
                <td className="py-3 pr-4">
                  {u.role === "admin" ? (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-semibold uppercase tracking-wider">
                      Admin
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-700/50 text-zinc-400 border-zinc-600/40 text-[10px] font-semibold uppercase tracking-wider">
                      Usuario
                    </Badge>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {u.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                      Pendiente
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-zinc-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString("es-CL")}
                </td>
                <td className="py-3">
                  <button
                    onClick={() => openReset(u)}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Resetear contraseña
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Reset password modal ─────────────────────────────────────────────── */}

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) closeReset(); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Resetear contraseña
            </DialogTitle>
          </DialogHeader>

          {resetSuccess ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-400 space-y-1">
                <p className="font-medium">Contraseña actualizada correctamente.</p>
                <p className="text-emerald-500/70">
                  Comunica la nueva contraseña al usuario.
                </p>
              </div>
              <Button
                onClick={closeReset}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4 pt-1">
              {/* Read-only user info */}
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2.5 space-y-0.5">
                <p className="text-xs text-zinc-500">Usuario</p>
                <p className="text-sm text-zinc-200">{resetTarget?.name ?? resetTarget?.email}</p>
                {resetTarget?.name && (
                  <p className="text-xs text-zinc-500 font-mono">{resetTarget.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-zinc-300 text-sm">
                  Nueva contraseña temporal
                </Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-zinc-300 text-sm">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  autoComplete="new-password"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/60"
                />
              </div>

              {resetError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {resetError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeReset}
                  className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold disabled:opacity-40"
                >
                  {resetLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando…</>
                    : "Guardar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
