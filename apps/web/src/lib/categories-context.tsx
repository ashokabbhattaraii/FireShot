"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface CategoriesContextType {
  thumbnailMap: Record<string, string>;
}

const Ctx = createContext<CategoriesContextType>({ thumbnailMap: {} });

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    api("/categories").then(setCategories).catch(() => {});
  }, []);

  const thumbnailMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      for (const child of cat.children ?? []) {
        if (child.gameMode && child.thumbnailUrl) {
          map[child.gameMode] = child.thumbnailUrl;
        }
      }
    }
    return map;
  }, [categories]);

  return <Ctx.Provider value={{ thumbnailMap }}>{children}</Ctx.Provider>;
}

export function useCategories() {
  return useContext(Ctx);
}
