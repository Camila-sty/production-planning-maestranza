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

  const { llegada, inicio, entregado: _ent, ...rest } = parsed.data;

  try {
    const record = await prisma.salesPlanning.create({
      data: {
        ...rest,
        llegada: llegada ? new Date(llegada) : null,
        inicio: inicio ? new Date(inicio) : null,
        entregado: false, // always false on creation — set via edit only
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

  const { llegada, inicio, entregado, ...rest } = parsed.data;
  const newEntregado = entregado ?? false;

  // Auto-set fecha_entrega_real when transitioning entregado false → true
  let fechaEntregaReal: Date | undefined;
  const current = await prisma.salesPlanning.findUnique({
    where: { id },
    select: { entregado: true, fecha_entrega_real: true },
  });
  if (!current?.entregado && newEntregado && !current?.fecha_entrega_real) {
    const activeRun = await prisma.planningRun.findFirst({ where: { status: "ACTIVE" } });
    if (activeRun) {
      const opt = await prisma.salesPlanningOptimized.findFirst({
        where: { sales_planning_id: id, planning_run_id: activeRun.id },
        select: { end_date: true },
      });
      if (opt?.end_date) fechaEntregaReal = new Date(opt.end_date);
    }
  }

  try {
    const record = await prisma.salesPlanning.update({
      where: { id },
      data: {
        ...rest,
        llegada: llegada ? new Date(llegada) : null,
        inicio: inicio ? new Date(inicio) : null,
        entregado: newEntregado,
        ...(fechaEntregaReal !== undefined ? { fecha_entrega_real: fechaEntregaReal } : {}),
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
    // Read the current buffer to compute the incremental delta.
    // delta = new - prev. The planner uses this delta history so that
    // changing from -2 to -3 only adds 1 more day of delay (not 3 fresh days).
    const current = await prisma.salesPlanning.findUnique({
      where: { id: salesPlanningId },
      select: { planning_buffer_days: true },
    });
    const prevBuffer = current?.planning_buffer_days ?? 0;
    const newBuffer  = parsed.data.buffer_days;
    const deltaDays  = newBuffer - prevBuffer;

    await prisma.$transaction([
      prisma.salesPlanning.update({
        where: { id: salesPlanningId },
        data: {
          planning_buffer_days: newBuffer,
          planning_buffer_note: parsed.data.note ?? null,
          planning_buffer_at:   new Date(),
          updated_by: user.email,
        },
      }),
      prisma.planningBufferAdjustment.create({
        data: {
          sales_planning_id: salesPlanningId,
          buffer_days:       newBuffer,
          prev_buffer_days:  prevBuffer,
          delta_days:        deltaDays,
          note:              parsed.data.note ?? null,
          created_by:        user.email,
        },
      }),
    ]);

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Error al guardar el buffer" };
  }
}
