"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { leadTimeSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createLeadTime(data: z.infer<typeof leadTimeSchema>) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  const parsed = leadTimeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const record = await prisma.leadTimeByCode.create({ data: parsed.data });
    revalidatePath("/");
    return { data: record };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) return { error: "Ya existe ese código+proceso" };
    console.error(e);
    return { error: "Error al crear el registro" };
  }
}

export async function updateLeadTime(
  id: string,
  data: z.infer<typeof leadTimeSchema>
) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  const parsed = leadTimeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const record = await prisma.leadTimeByCode.update({
      where: { id },
      data: parsed.data,
    });
    revalidatePath("/");
    return { data: record };
  } catch (e) {
    console.error(e);
    return { error: "Error al actualizar" };
  }
}

export async function deleteLeadTime(id: string) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  try {
    await prisma.leadTimeByCode.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Error al eliminar" };
  }
}
