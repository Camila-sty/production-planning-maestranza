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
import {
  Loader2,
  KeyRound,
  RefreshCw,
  Trash2,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import type { AdminUser } from "@/app/api/admin/users/route";

interface Props {
  currentUserId: string;
}

export function UsersPanel({ currentUserId }: Props) {
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Reset password modal ───────────────────────────────────────────────────
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError,   setResetError]   = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // ── Delete / reactivate confirm modal ─────────────────────────────────────
  const [statusTarget, setStatusTarget]   = useState<AdminUser | null>(null);
  const [statusAction, setStatusAction]   = useState<"deleted" | "active">("deleted");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError,   setStatusError]   = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) setFetchError(data.error ?? "Error al cargar usuarios.");
      else setUsers(data.users ?? []);
    } catch {
      setFetchError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  // ── Reset password handlers ────────────────────────────────────────────────

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
    if (newPassword.length < 8) { setResetError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPassword !== confirmPw) { setResetError("Las contraseñas no coinciden."); return; }
    setResetLoading(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget!.id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) setResetError(data.error ?? "Error al actualizar la contraseña.");
      else setResetSuccess(true);
    } catch {
      setResetError("Error de red.");
    } finally {
      setResetLoading(false);
    }
  }

  // ── Status change handlers ─────────────────────────────────────────────────

  function openStatus(u: AdminUser, action: "deleted" | "active") {
    setStatusTarget(u);
    setStatusAction(action);
    setStatusError(null);
  }

  function closeStatus() {
    setStatusTarget(null);
    setStatusError(null);
  }

  async function handleStatusChange() {
    if (!statusTarget) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/admin/users/${statusTarget.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusAction }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatusError(data.error ?? "Error al actualizar el estado.");
      } else {
        closeStatus();
        await loadUsers();
      }
    } catch {
      setStatusError("Error de red.");
    } finally {
      setStatusLoading(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

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

  const activeCount  = users.filter((u) => u.status === "active").length;
  const deletedCount = users.filter((u) => u.status === "deleted").length;

  // ── Table ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500">
          {activeCount} activo{activeCount !== 1 ? "s" : ""}
          {deletedCount > 0 && ` · ${deletedCount} eliminado${deletedCount !== 1 ? "s" : ""}`}
        </p>
        <Button variant="ghost" size="sm" onClick={loadUsers} className="text-zinc-500 hover:text-white h-7 px-2">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              {["Nombre", "Correo", "Dominio", "Rol", "Estado", "Creado", "Acciones"].map((h) => (
                <th key={h} className="pb-2 pr-4 text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {users.map((u) => {
              const isDeleted  = u.status === "deleted";
              const isSelf     = u.id === currentUserId;
              const isCorporate = u.domain === "etpequipos.cl";

              return (
                <tr
                  key={u.id}
                  className={`transition-colors ${isDeleted ? "opacity-50" : "hover:bg-zinc-800/30"}`}
                >
                  {/* Nombre */}
                  <td className="py-3 pr-4 text-zinc-300">
                    {u.name ?? <span className="text-zinc-600 italic">—</span>}
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] text-zinc-600">(tú)</span>
                    )}
                  </td>

                  {/* Correo */}
                  <td className="py-3 pr-4 text-zinc-300 font-mono text-xs">{u.email}</td>

                  {/* Dominio */}
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs font-mono ${
                        isCorporate ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {u.domain || "—"}
                    </span>
                  </td>

                  {/* Rol */}
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

                  {/* Estado */}
                  <td className="py-3 pr-4">
                    {isDeleted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Eliminado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Activo
                      </span>
                    )}
                  </td>

                  {/* Creado */}
                  <td className="py-3 pr-4 text-zinc-500 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString("es-CL")}
                  </td>

                  {/* Acciones */}
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      {/* Reset contraseña — disabled for deleted */}
                      <button
                        onClick={() => openReset(u)}
                        disabled={isDeleted}
                        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={isDeleted ? "Usuario eliminado" : "Resetear contraseña"}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Resetear
                      </button>

                      {/* Eliminar / Reactivar */}
                      {isDeleted ? (
                        <button
                          onClick={() => openStatus(u, "active")}
                          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                          title="Reactivar usuario"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => openStatus(u, "deleted")}
                          disabled={isSelf}
                          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isSelf ? "No puedes eliminarte a ti mismo" : "Eliminar usuario"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
                <p className="text-emerald-500/70">Comunica la nueva contraseña al usuario.</p>
              </div>
              <Button onClick={closeReset} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4 pt-1">
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2.5 space-y-0.5">
                <p className="text-xs text-zinc-500">Usuario</p>
                <p className="text-sm text-zinc-200">{resetTarget?.name ?? resetTarget?.email}</p>
                {resetTarget?.name && (
                  <p className="text-xs text-zinc-500 font-mono">{resetTarget.email}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-zinc-300 text-sm">Nueva contraseña temporal</Label>
                <Input
                  id="new-pw" type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres" required autoComplete="new-password"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-zinc-300 text-sm">Confirmar contraseña</Label>
                <Input
                  id="confirm-pw" type="password" value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repite la contraseña" required autoComplete="new-password"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/50"
                />
              </div>
              {resetError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{resetError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeReset} className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800">
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetLoading} className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold disabled:opacity-40">
                  {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando…</> : "Guardar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete / Reactivate confirm modal ───────────────────────────────── */}

      <Dialog open={!!statusTarget} onOpenChange={(open) => { if (!open) closeStatus(); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              {statusAction === "deleted" ? (
                <><Trash2 className="w-4 h-4 text-red-400" />Eliminar usuario</>
              ) : (
                <><RotateCcw className="w-4 h-4 text-emerald-400" />Reactivar usuario</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* User info */}
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2.5 space-y-0.5">
              <p className="text-xs text-zinc-500">Usuario</p>
              <p className="text-sm text-zinc-200">{statusTarget?.name ?? statusTarget?.email}</p>
              {statusTarget?.name && (
                <p className="text-xs text-zinc-500 font-mono">{statusTarget.email}</p>
              )}
            </div>

            {/* Warning message */}
            <div className={`rounded-lg border px-3 py-3 flex gap-2.5 text-sm ${
              statusAction === "deleted"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}>
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {statusAction === "deleted"
                  ? "El usuario quedará desactivado y no podrá iniciar sesión. Sus registros históricos no se eliminarán."
                  : "El usuario podrá volver a iniciar sesión."}
              </span>
            </div>

            {statusError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{statusError}</p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={closeStatus} className="flex-1 text-zinc-400 hover:text-white hover:bg-zinc-800">
                Cancelar
              </Button>
              <Button
                onClick={handleStatusChange}
                disabled={statusLoading}
                className={`flex-1 font-semibold disabled:opacity-40 ${
                  statusAction === "deleted"
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {statusLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Procesando…</>
                  : statusAction === "deleted" ? "Confirmar eliminación" : "Confirmar reactivación"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
