"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { processCapacitySchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createProcessCapacity(
  data: z.infer<typeof processCapacitySchema>
) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  const parsed = processCapacitySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const record = await prisma.processCapacity.create({ data: parsed.data });
    revalidatePath("/");
    return { data: record };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) return { error: "Ya existe ese proceso" };
    console.error(e);
    return { error: "Error al crear" };
  }
}

export async function updateProcessCapacity(
  id: string,
  data: z.infer<typeof processCapacitySchema>
) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  const parsed = processCapacitySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const record = await prisma.processCapacity.update({
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

export async function deleteProcessCapacity(id: string) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  try {
    await prisma.processCapacity.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Error al eliminar" };
  }
}
