"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ── Local username/password auth (DEV_AUTH=true) ─────────────────────────────

export async function localLogin(
  username: string,
  password: string
): Promise<{ error?: string }> {
  const user = await prisma.localUser.findUnique({ where: { username } });
  if (!user) return { error: "Usuario o contraseña incorrectos" };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return { error: "Usuario o contraseña incorrectos" };

  const cookieStore = await cookies();
  cookieStore.set("dev-session", username, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  return {};
}

export async function localRegister(
  username: string,
  password: string
): Promise<{ error?: string }> {
  const existing = await prisma.localUser.findUnique({ where: { username } });
  if (existing) return { error: "Ese nombre de usuario ya está en uso" };

  const password_hash = await bcrypt.hash(password, 10);
  await prisma.localUser.create({ data: { username, password_hash } });

  const cookieStore = await cookies();
  cookieStore.set("dev-session", username, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  return {};
}

// ── Supabase auth (production) ────────────────────────────────────────────────

export async function login(formData: FormData) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signup(formData: FormData) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });
  if (error) return { error: error.message };
  return { success: "Revisa tu correo para confirmar tu cuenta." };
}

// ── Logout (both modes) ───────────────────────────────────────────────────────

export async function logout() {
  if (process.env.DEV_AUTH === "true") {
    const cookieStore = await cookies();
    cookieStore.delete("dev-session");
    redirect("/auth/login");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
