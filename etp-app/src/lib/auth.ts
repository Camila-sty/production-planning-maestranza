import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ALLOWED_EMAIL_DOMAINS, ADMIN_EMAIL_EXCEPTIONS } from "@/lib/validations";

export type AppUser = { id: string; email: string; isAdmin: boolean };

/** Returns true if the email is allowed: either a corporate domain or an admin exception. */
export function isAllowedDomain(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if ((ADMIN_EMAIL_EXCEPTIONS as readonly string[]).includes(normalized)) return true;
  const domain = normalized.split("@")[1];
  return !!domain && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

/**
 * Returns true if the given email is in the ADMIN_EMAILS env var.
 * Comparison is case-insensitive and ignores surrounding spaces.
 */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

/**
 * Returns the authenticated user.
 * DEV_AUTH=true  → reads email from dev-session cookie (local_users table)
 * production     → reads from Supabase session
 *
 * Only call from Server Components, Server Actions, and Route Handlers.
 */
export async function getUser(): Promise<AppUser | null> {
  if (process.env.DEV_AUTH === "true") {
    const cookieStore = await cookies();
    const session = cookieStore.get("dev-session");
    const email = session?.value;
    if (!email) return null;
    // Check is_active — deleted users are denied access.
    const localUser = await prisma.localUser.findUnique({ where: { email } });
    if (!localUser || !localUser.is_active) return null;
    return { id: email, email, isAdmin: isAdminEmail(email) };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Deny access to users marked as deleted via app_metadata.
  if (user.app_metadata?.status === "deleted") return null;
  const email = user.email ?? "";
  return { id: user.id, email, isAdmin: isAdminEmail(email) };
}
