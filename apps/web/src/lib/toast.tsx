"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type Variant = "success" | "error" | "warning" | "info";
interface Toast { id: number; variant: Variant; message: string }

const Ctx = createContext<{
  push: (variant: Variant, message: string) => void;
}>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((variant: Variant, message: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, variant, message }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 space-y-2 px-4 w-full max-w-sm pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur ${
              t.variant === "success"
                ? "border-neon-green/40 bg-neon-green/10 text-neon-green"
                : t.variant === "error"
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : t.variant === "warning"
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    : "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
            }`}
          >
            {t.variant === "success" && <CheckCircle2 size={16} className="shrink-0" />}
            {t.variant === "error" && <XCircle size={16} className="shrink-0" />}
            {t.variant === "warning" && <AlertTriangle size={16} className="shrink-0" />}
            {t.variant === "info" && <Info size={16} className="shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}
              className="text-white/40"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const { push } = useContext(Ctx);
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    warning: (m: string) => push("warning", m),
    info: (m: string) => push("info", m),
  };
}

// Maps API error messages to user-friendly toast actions.
export function handleJoinError(err: unknown, toast: ReturnType<typeof useToast>) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/already joined|cannot join your own/i.test(msg)) {
    toast.warning("You have already joined this match.");
  } else if (/not eligible|level|headshot|emulator|blacklist/i.test(msg)) {
    toast.error("You don't meet the eligibility requirements.");
  } else if (/full/i.test(msg)) {
    toast.error("This room is full. Try another match.");
  } else if (/insufficient|balance/i.test(msg)) {
    toast.error("Insufficient wallet balance. Please deposit first.");
  } else if (/already taken/i.test(msg)) {
    toast.error("Challenge already taken by another player.");
  } else {
    toast.error(msg || "Something went wrong. Please try again.");
  }
}
