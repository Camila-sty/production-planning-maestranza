"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, isAllowedDomain } from "@/lib/auth";
import bcrypt from "bcryptjs";

// ── Local email/password auth (DEV_AUTH=true) ────────────────────────────────

export async function localLogin(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const user = await prisma.localUser.findUnique({ where: { email } });
  if (!user) return { error: "Correo o contraseña incorrectos" };
  if (!user.is_active) return { error: "Cuenta desactivada. Contacta al administrador." };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return { error: "Correo o contraseña incorrectos" };

  // Auto-promote to admin role if email is in ADMIN_EMAILS
  const expectedRole = isAdminEmail(email) ? "admin" : "user";
  if (user.role !== expectedRole) {
    await prisma.localUser.update({ where: { email }, data: { role: expectedRole } });
  }

  const cookieStore = await cookies();
  cookieStore.set("dev-session", email, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  return {};
}

export async function localRegister(
  email: string,
  password: string,
  name?: string
): Promise<{ error?: string }> {
  if (process.env.ALLOW_PUBLIC_REGISTER === "false") {
    return { error: "El registro está deshabilitado. Contacta al administrador." };
  }

  if (!isAllowedDomain(email)) {
    return { error: "Solo se permiten correos corporativos con los dominios @equiposycamiones.cl, @pto.cl o @etpequipos.cl." };
  }

  const existing = await prisma.localUser.findUnique({ where: { email } });
  if (existing) return { error: "Ese correo ya está en uso" };

  const role = isAdminEmail(email) ? "admin" : "user";
  const password_hash = await bcrypt.hash(password, 10);
  await prisma.localUser.create({ data: { email, name, password_hash, role } });

  const cookieStore = await cookies();
  cookieStore.set("dev-session", email, {
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
