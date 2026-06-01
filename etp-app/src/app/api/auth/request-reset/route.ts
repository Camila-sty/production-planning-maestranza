import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  // Look up user — but always return ok to avoid revealing if email is registered.
  const userId = await findUserId(email);
  if (userId) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, user_id: userId, token_hash: tokenHash, expires_at: expiresAt },
    });

    await sendPasswordResetEmail(email, token);
  }

  // Always return ok — never reveal whether the email is registered.
  return NextResponse.json({ ok: true });
}

/**
 * Returns the user's ID string if found, or null if not found.
 * DEV_AUTH=true → looks in local_users table.
 * Production     → looks in Supabase Auth via admin API.
 */
async function findUserId(email: string): Promise<string | null> {
  if (process.env.DEV_AUTH === "true") {
    const user = await prisma.localUser.findUnique({ where: { email } });
    return user?.id ?? null;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    // listUsers is paginated; for an internal tool the first page is enough.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.error("[REQUEST RESET] listUsers error:", error.message);
      return null;
    }
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email
    );
    return match?.id ?? null;
  } catch (err) {
    console.error("[REQUEST RESET] admin client error:", err);
    return null;
  }
}
