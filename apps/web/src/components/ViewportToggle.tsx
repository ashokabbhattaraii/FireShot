"use client";
import { Monitor, Smartphone } from "lucide-react";
import { useViewport } from "@/lib/viewport-context";

export function ViewportToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useViewport();

  if (compact) {
    return (
      <button
        onClick={() => setMode(mode === "web" ? "mobile" : "web")}
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: "var(--fs-surface-2)", border: "1px solid var(--fs-border)" }}
        aria-label={`Switch to ${mode === "web" ? "mobile" : "web"} view`}
        title={`Switch to ${mode === "web" ? "Mobile" : "Web"} View`}
      >
        {mode === "web" ? <Monitor size={16} style={{ color: "var(--fs-text-2)" }} /> : <Smartphone size={16} style={{ color: "var(--fs-text-2)" }} />}
      </button>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 8,
        border: "1px solid var(--fs-border)",
        background: "var(--fs-surface-2)",
        padding: 2,
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setMode("web")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 6,
          padding: "4px 10px",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
          background: mode === "web" ? "var(--fs-red)" : "transparent",
          color: mode === "web" ? "#fff" : "var(--fs-text-3)",
          transition: "all .15s",
        }}
      >
        <Monitor size={12} /> Web
      </button>
      <button
        onClick={() => setMode("mobile")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 6,
          padding: "4px 10px",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
          background: mode === "mobile" ? "var(--fs-red)" : "transparent",
          color: mode === "mobile" ? "#fff" : "var(--fs-text-3)",
          transition: "all .15s",
        }}
      >
        <Smartphone size={12} /> App
      </button>
    </div>
  );
}
