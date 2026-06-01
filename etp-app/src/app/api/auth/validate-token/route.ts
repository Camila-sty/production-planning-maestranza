import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/validate-token?token=TOKEN
 *
 * Lightweight check — does NOT consume the token.
 * Returns { valid: true, email } or { valid: false, reason }.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false, reason: "missing" });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!record) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }
  if (record.used_at) {
    return NextResponse.json({ valid: false, reason: "used" });
  }
  if (record.expires_at < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({ valid: true, email: record.email });
}
