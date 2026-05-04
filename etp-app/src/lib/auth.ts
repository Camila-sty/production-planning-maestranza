import { cookies } from "next/headers";

export type AppUser = { id: string; email: string };

/**
 * Returns the authenticated user.
 * DEV_AUTH=true  → reads username from dev-session cookie (local SQLite users)
 * production     → reads from Supabase session
 *
 * Only call from Server Components, Server Actions, and Route Handlers.
 */
export async function getUser(): Promise<AppUser | null> {
  if (process.env.DEV_AUTH === "true") {
    const cookieStore = await cookies();
    const session = cookieStore.get("dev-session");
    const username = session?.value;
    if (!username) return null;
    return { id: username, email: username };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? "" } : null;
}
