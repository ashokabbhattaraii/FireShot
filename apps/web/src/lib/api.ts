function normalizeApiUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

const API = normalizeApiUrl(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
);

interface ApiRequestInit extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function token(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("fs_token")?.trim();
  if (!stored || stored === "undefined" || stored === "null") {
    localStorage.removeItem("fs_token");
    return null;
  }
  return stored;
}

export async function api<T = any>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const { timeoutMs = 12_000, retries = 1, ...requestInit } = init;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const maxAttempts = method === "GET" ? retries + 1 : 1;
  const headers: Record<string, string> = {
    ...(requestInit.headers as Record<string, string> | undefined),
  };
  if (!(requestInit.body instanceof FormData) && requestInit.body) {
    headers["Content-Type"] = "application/json";
  }
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API}${path}`, {
        ...requestInit,
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      if (!res.ok) {
        let message = text || res.statusText;
        try {
          const data = JSON.parse(text);
          message =
            (Array.isArray(data.message) ? data.message[0] : data.message) ||
            data.error ||
            message;
        } catch {
          // Keep the raw response text when the server did not return JSON.
        }
        if (res.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem("fs_token");
        }
        const error = new Error(message);
        if (method === "GET" && res.status >= 500 && attempt < maxAttempts - 1) {
          lastError = error;
          await sleep(200 * 2 ** attempt);
          continue;
        }
        throw error;
      }
      if (res.status === 204) return undefined as T;

      if (!text) return undefined as T;
      const data = JSON.parse(text);
      if (
        data &&
        typeof data === "object" &&
        "success" in data &&
        "data" in data
      ) {
        return data.data as T;
      }
      return data as T;
    } catch (error) {
      clearTimeout(timer);
      const nextError =
        (error as Error)?.name === "AbortError"
          ? new Error("Request timed out")
          : (error as Error);
      if (method === "GET" && attempt < maxAttempts - 1) {
        lastError = nextError;
        await sleep(200 * 2 ** attempt);
        continue;
      }
      throw nextError;
    }
  }
  throw lastError ?? new Error("Request failed");
}

export const auth = {
  setToken: (t?: string | null) => {
    const value = t?.trim();
    if (!value || value === "undefined" || value === "null") {
      localStorage.removeItem("fs_token");
      throw new Error("Missing auth token");
    }
    localStorage.setItem("fs_token", value);
  },
  clear: () => localStorage.removeItem("fs_token"),
  token,
};

export const API_BASE = API;
export const FILE_BASE = API.replace(/\/api$/, "");
