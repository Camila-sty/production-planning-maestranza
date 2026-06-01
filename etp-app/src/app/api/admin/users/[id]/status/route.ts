import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StatusValue = "active" | "deleted";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json(
      { error: "No autorizado: requiere rol administrador." },
      { status: 403 }
    );
  }

  const { id: targetId } = await params;

  let status: StatusValue;
  try {
    const body = await req.json();
    if (body?.status !== "active" && body?.status !== "deleted") {
      return NextResponse.json({ error: "status debe ser 'active' o 'deleted'." }, { status: 400 });
    }
    status = body.status as StatusValue;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Safety: prevent self-deletion
  if (status === "deleted" && targetId === currentUser.id) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta." },
      { status: 400 }
    );
  }

  if (process.env.DEV_AUTH === "true") {
    const target = await prisma.localUser.findUnique({ where: { id: targetId } });
    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    // Prevent deleting the last active admin
    if (status === "deleted" && target.role === "admin") {
      const activeAdmins = await prisma.localUser.count({
        where: { role: "admin", is_active: true, NOT: { id: targetId } },
      });
      if (activeAdmins === 0) {
        return NextResponse.json(
          { error: "No se puede desactivar al último administrador activo." },
          { status: 400 }
        );
      }
    }

    await prisma.localUser.update({
      where: { id: targetId },
      data: { is_active: status === "active" },
    });
    return NextResponse.json({ ok: true });
  }

  // Production — Supabase Auth
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // Prevent deleting the last active admin (Supabase)
    if (status === "deleted") {
      const targetUser = await admin.auth.admin.getUserById(targetId);
      if (targetUser.data?.user && isAdminEmail(targetUser.data.user.email ?? "")) {
        const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const activeAdmins = (allUsers?.users ?? []).filter(
          (u) =>
            isAdminEmail(u.email ?? "") &&
            u.app_metadata?.status !== "deleted" &&
            u.id !== targetId
        );
        if (activeAdmins.length === 0) {
          return NextResponse.json(
            { error: "No se puede desactivar al último administrador activo." },
            { status: 400 }
          );
        }
      }
    }

    const { error } = await admin.auth.admin.updateUserById(targetId, {
      app_metadata: { status },
    });
    if (error) {
      console.error("[STATUS PATCH] updateUserById error:", error.message);
      return NextResponse.json(
        { error: "No se pudo actualizar el estado del usuario." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[STATUS PATCH] admin client error:", err);
    return NextResponse.json(
      { error: "Error interno. Verifica SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }
}
