import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { ThemedToaster } from "@/components/themed-toaster";
import { ProcessCapacityTable } from "@/components/planning/process-capacity-table";
import { LeadTimeTable } from "@/components/planning/lead-time-table";
import type { LeadTimeByCode, ProcessCapacity } from "@/types";

export const dynamic = "force-dynamic";

export default async function ReglaPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");
  if (!user.isAdmin) redirect("/");

  const [processCapacities, leadTimes] = await Promise.all([
    prisma.processCapacity.findMany({ orderBy: { orden: "asc" } }),
    prisma.leadTimeByCode.findMany({
      orderBy: [{ codigo_plazo: "asc" }, { proceso: "asc" }],
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <ThemedToaster />
      <AppHeader user={user} />

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-10">

        {/* Capacidad por Proceso */}
        <section>
          <SectionTitle count={processCapacities.length}>
            Capacidad por Proceso
          </SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 mb-3">
              Define el orden global de procesos y cuántos equipos pueden estar
              simultáneamente en cada proceso (días hábiles). Procesos con orden=0
              o capacidad=0 son ignorados por el planificador.
            </p>
            <ProcessCapacityTable
              records={processCapacities as unknown as ProcessCapacity[]}
              isAdmin={true}
            />
          </div>
        </section>

        {/* Tiempos por Código Plazo */}
        <section>
          <SectionTitle count={leadTimes.length}>
            Tiempos por Código Plazo
          </SectionTitle>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 mb-3">
              Duración en días hábiles de cada proceso según el tipo de equipo
              (código plazo). Filas con duración=0 son ignoradas por el
              planificador.
            </p>
            <LeadTimeTable
              records={leadTimes as unknown as LeadTimeByCode[]}
              processes={processCapacities as unknown as ProcessCapacity[]}
              isAdmin={true}
            />
          </div>
        </section>

      </main>
    </div>
  );
}

function SectionTitle({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-amber-500 rounded-full" />
      <h2 className="text-base font-semibold text-white">{children}</h2>
      {count != null && (
        <span className="text-xs text-zinc-600 ml-1">({count})</span>
      )}
    </div>
  );
}
