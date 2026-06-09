import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!user.isAdmin)
    return NextResponse.json({ error: "No autorizado: requiere rol administrador." }, { status: 403 });

  const { id } = await params;

  const day = await prisma.specialWorkingDay.findUnique({
    where: { id },
  });

  if (!day) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.specialWorkingDay.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
