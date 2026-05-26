import { cookies } from "next/headers";

export type AppUser = { id: string; email: string; isAdmin: boolean };

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
    return { id: email, email, isAdmin: isAdminEmail(email) };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const email = user.email ?? "";
  return { id: user.id, email, isAdmin: isAdminEmail(email) };
}
