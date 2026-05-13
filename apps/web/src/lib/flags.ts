import useSWR from "swr";
import { api } from "./api";

const fetcher = (path: string) => api<Record<string, boolean>>(path);

export function useFlags() {
  const { data } = useSWR("/app/flags", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    fallbackData: {},
  });
  const isEnabled = (key: string): boolean => data?.[key] !== false;
  return { flags: data ?? {}, isEnabled };
}
