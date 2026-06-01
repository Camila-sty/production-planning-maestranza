import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  let token: string, password: string;
  try {
    const body = await req.json();
    token    = typeof body?.token    === "string" ? body.token    : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Token requerido." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 }
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!record) {
    return NextResponse.json(
      { error: "El enlace expiró o ya fue usado." },
      { status: 400 }
    );
  }
  if (record.used_at) {
    return NextResponse.json(
      { error: "Este enlace ya fue utilizado. Solicita uno nuevo." },
      { status: 400 }
    );
  }
  if (record.expires_at < new Date()) {
    return NextResponse.json(
      { error: "El enlace expiró. Solicita uno nuevo." },
      { status: 400 }
    );
  }

  // Update the password
  const updateError = await updateUserPassword(record.user_id, record.email, password);
  if (updateError) {
    return NextResponse.json({ error: updateError }, { status: 500 });
  }

  // Mark token as used (one-time use)
  await prisma.passwordResetToken.update({
    where: { token_hash: tokenHash },
    data: { used_at: new Date() },
  });

  return NextResponse.json({ ok: true });
}

/**
 * Updates the user's password.
 * Returns null on success, or an error message string on failure.
 */
async function updateUserPassword(
  userId: string,
  email: string,
  newPassword: string
): Promise<string | null> {
  if (process.env.DEV_AUTH === "true") {
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.localUser.update({
      where: { email },
      data: { password_hash: hash },
    });
    return null;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) {
      console.error("[DO RESET] Supabase updateUserById error:", error.message);
      return "No se pudo actualizar la contraseña. Intenta nuevamente.";
    }
    return null;
  } catch (err) {
    console.error("[DO RESET] admin client error:", err);
    return "Error interno. Intenta nuevamente.";
  }
}
