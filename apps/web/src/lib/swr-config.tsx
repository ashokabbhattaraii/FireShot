"use client";

import { SWRConfig } from "swr";
import { api } from "./api";

const fetcher = (url: string) => api(url);

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ fetcher }}>{children}</SWRConfig>;
}
