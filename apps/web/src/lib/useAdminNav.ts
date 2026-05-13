import useSWR from "swr";
import { api } from "./api";

export function useAdminNav() {
  const { data, isLoading } = useSWR<string[]>("/admin/auth/nav", (path: string) =>
    api<string[]>(path),
  );
  return { nav: data, isLoading };
}
