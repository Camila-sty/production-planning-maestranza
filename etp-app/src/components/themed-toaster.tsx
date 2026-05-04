"use client";

import { useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={(resolvedTheme as "dark" | "light") ?? "dark"}
      position="top-right"
    />
  );
}
