"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { salesPlanningSchema, planningBufferSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createRecord(data: z.infer<typeof salesPlanningSchema>) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  const parsed = salesPlanningSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { llegada, ...rest } = parsed.data;

  try {
    const record = await prisma.salesPlanning.create({
      data: {
        ...rest,
        llegada: llegada ? new Date(llegada) : null,
        created_by: user.email,
        updated_by: user.email,
      },
    });

    revalidatePath("/");
    return { data: record };
  } catch (e) {
    console.error(e);
    return { error: "Error al crear el registro" };
  }
}

export async function updateRecord(
  id: string,
  data: z.infer<typeof salesPlanningSchema>
) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  const parsed = salesPlanningSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { llegada, ...rest } = parsed.data;

  try {
    const record = await prisma.salesPlanning.update({
      where: { id },
      data: {
        ...rest,
        llegada: llegada ? new Date(llegada) : null,
        updated_by: user.email,
      },
    });

    revalidatePath("/");
    return { data: record };
  } catch (e) {
    console.error(e);
    return { error: "Error al actualizar el registro" };
  }
}

export async function deleteRecord(id: string) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  try {
    await prisma.salesPlanning.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Error al eliminar el registro" };
  }
}

export async function getRecords() {
  try {
    const records = await prisma.salesPlanning.findMany({
      orderBy: { created_at: "asc" },
    });
    return { data: records };
  } catch (e) {
    console.error(e);
    return { error: "Error al obtener los registros" };
  }
}

export async function upsertBuffer(
  salesPlanningId: string,
  data: z.infer<typeof planningBufferSchema>
) {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!user.isAdmin) return { error: "No autorizado: requiere rol administrador." };

  const parsed = planningBufferSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    await prisma.salesPlanning.update({
      where: { id: salesPlanningId },
      data: {
        planning_buffer_days: parsed.data.buffer_days,
        planning_buffer_note: parsed.data.note ?? null,
        planning_buffer_at: new Date(),
        updated_by: user.email,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Error al guardar el buffer" };
  }
}
