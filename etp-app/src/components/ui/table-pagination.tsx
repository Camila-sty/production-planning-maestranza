"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TablePagination({
  page,
  totalPages,
  totalRecords,
  pageSize,
  onPrev,
  onNext,
}: TablePaginationProps) {
  if (totalRecords <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRecords);

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-zinc-500">
        Mostrando {from}–{to} de {totalRecords} registros
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={page === 1}
          onClick={onPrev}
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Anterior
        </Button>
        <span className="text-xs text-zinc-400 tabular-nums">
          Página {page} de {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={page === totalPages}
          onClick={onNext}
        >
          Siguiente
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
