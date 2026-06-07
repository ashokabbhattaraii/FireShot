"use client";

import { SWRConfig } from "swr";
import { api } from "./api";

const fetcher = (url: string) => api(url);

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 10_000,
        focusThrottleInterval: 30_000,
        errorRetryCount: 1,
        errorRetryInterval: 2_000,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
