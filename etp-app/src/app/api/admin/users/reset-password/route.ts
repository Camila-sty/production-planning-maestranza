import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "No autorizado: requiere rol administrador." },
      { status: 403 }
    );
  }

  let userId: string, newPassword: string;
  try {
    const body = await req.json();
    userId      = typeof body?.userId      === "string" ? body.userId.trim()      : "";
    newPassword = typeof body?.newPassword === "string" ? body.newPassword        : "";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId requerido." }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  if (process.env.DEV_AUTH === "true") {
    const localUser = await prisma.localUser.findUnique({ where: { id: userId } });
    if (!localUser) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.localUser.update({ where: { id: userId }, data: { password_hash: hash } });
    return NextResponse.json({ ok: true });
  }

  // Production — Supabase Auth admin API
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) {
      console.error("[ADMIN RESET PW] updateUserById error:", error.message);
      return NextResponse.json(
        { error: "No se pudo actualizar la contraseña." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ADMIN RESET PW] admin client error:", err);
    return NextResponse.json(
      { error: "Error interno. Verifica SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }
}
