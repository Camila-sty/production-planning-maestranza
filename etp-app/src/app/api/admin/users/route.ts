import { NextResponse } from "next/server";
import { getUser, isAdminEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export async function GET() {
  const user = await getUser();
  if (!user?.isAdmin) {
    return NextResponse.json(
      { error: "No autorizado: requiere rol administrador." },
      { status: 403 }
    );
  }

  if (process.env.DEV_AUTH === "true") {
    const locals = await prisma.localUser.findMany({ orderBy: { created_at: "asc" } });
    const users: AdminUser[] = locals.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? null,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at.toISOString(),
    }));
    return NextResponse.json({ users });
  }

  // Production — Supabase Auth
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.error("[ADMIN USERS] listUsers error:", error.message);
      return NextResponse.json({ error: "Error al obtener usuarios." }, { status: 500 });
    }

    const users: AdminUser[] = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.name as string | undefined) ?? null,
      role: isAdminEmail(u.email ?? "") ? "admin" : "user",
      isActive: !!u.email_confirmed_at,
      createdAt: u.created_at,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[ADMIN USERS] admin client error:", err);
    return NextResponse.json(
      { error: "No se pudo conectar al servicio de usuarios. Verifica SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }
}
