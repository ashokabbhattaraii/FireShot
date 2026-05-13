"use client";
import { useViewport } from "@/lib/viewport-context";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { mode } = useViewport();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const maxW = isAdmin || mode === "web" ? "100%" : "480px";

  return (
    <div className="mx-auto min-h-screen w-full" style={{ maxWidth: maxW, background: "var(--fs-bg)" }}>
      {children}
    </div>
  );
}
