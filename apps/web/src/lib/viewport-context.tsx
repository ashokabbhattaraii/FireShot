"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-context";

export type ViewMode = "web" | "mobile";

const Ctx = createContext<{
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  toggle: () => void;
}>({ mode: "mobile", setMode: () => {}, toggle: () => {} });

const STORAGE_KEY = "fs_view_mode";

export function ViewportProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [mode, setModeState] = useState<ViewMode>("mobile");
  const [hydrated, setHydrated] = useState(false);

  // First hydration: read stored choice, else fall back to role default once auth resolves.
  // Admin pages always default to "web" view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isAdminPage = window.location.pathname.startsWith("/admin");
    const stored = localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    if (isAdminPage) {
      setModeState("web");
      setHydrated(true);
      return;
    }
    if (stored === "web" || stored === "mobile") {
      setModeState(stored);
      setHydrated(true);
      return;
    }
    if (!loading) {
      setModeState(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "web" : "mobile");
      setHydrated(true);
    }
  }, [loading, user]);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  };

  return (
    <Ctx.Provider
      value={{
        mode,
        setMode,
        toggle: () => setMode(mode === "web" ? "mobile" : "web"),
      }}
    >
      <div data-view-mode={mode} data-hydrated={hydrated}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export const useViewport = () => useContext(Ctx);
