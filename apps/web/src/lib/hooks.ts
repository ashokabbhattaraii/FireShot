"use client";

import useSWR, { mutate } from "swr";
import hotToast from "react-hot-toast";
import { api } from "./api";

type Filters = Record<string, string | number | boolean | null | undefined>;

const toast = {
  success: hotToast.success,
  error: hotToast.error,
  warning: (message: string) => hotToast(message),
};

function cacheKey(path: string, filters: Filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function post(body?: unknown): RequestInit {
  return {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function isCacheKey(prefix: string) {
  return (key: unknown) =>
    typeof key === "string" && (key === prefix || key.startsWith(`${prefix}?`));
}

// READ HOOKS
export const useTournaments = (filters: Filters = {}) =>
  useSWR(cacheKey("/tournaments", filters));
export const useTournament = (id: string) => useSWR(id ? `/tournaments/${id}` : null);
export const useCategories = () =>
  useSWR("/categories", { revalidateIfStale: false, revalidateOnFocus: false });
// categories almost never change -- aggressive cache
export const useChallenges = (filters: Filters = {}) =>
  useSWR(cacheKey("/challenges", filters));
export const useChallenge = (id: string) => useSWR(id ? `/challenges/${id}` : null);
export const useWallet = () => useSWR("/wallet", { refreshInterval: 30000 });
// wallet polls every 30s for balance updates
export const useNotifications = () =>
  useSWR("/notifications", { refreshInterval: 20000 });
export const useLeaderboard = () =>
  useSWR("/leaderboard", { revalidateIfStale: false });
export const useProfile = () => useSWR("/profile");
export const useFreeDailyStatus = () =>
  useSWR("/tournaments/free-daily/eligibility", { refreshInterval: 60000 });

// MUTATION HELPERS (optimistic update pattern)
export async function joinTournament(tournamentId: string, playerUids?: string[]) {
  try {
    // Optimistic: immediately update participant count in cache
    await mutate(
      `/tournaments/${tournamentId}`,
      async (current: any) => {
        if (playerUids?.length) {
          await api(`/tournaments/${tournamentId}/join`, post({ playerUids }));
        } else {
          await api(`/tournaments/${tournamentId}/join`, post());
        }
        return {
          ...current,
          hasJoined: true,
          filledSlots: (current?.filledSlots || 0) + 1,
        };
      },
      {
        optimisticData: (current: any) => ({
          ...current,
          hasJoined: true,
          filledSlots: (current?.filledSlots || 0) + 1,
        }),
        rollbackOnError: true,
        revalidate: true,
      },
    );
    toast.success("Successfully joined!");
    mutate("/wallet"); // refresh wallet balance
  } catch (e: any) {
    const msg = e.message;
    if (msg === "Already joined") toast.warning("You already joined this match.");
    else if (msg?.includes("full")) toast.error("This room is full.");
    else if (msg?.includes("balance")) toast.error("Insufficient wallet balance.");
    else if (msg?.includes("eligible")) {
      toast.error("You don't meet eligibility requirements.");
    } else toast.error(msg || "Failed to join.");
    throw e;
  }
}

export async function joinChallenge(challengeId: string, inviteCode?: string) {
  try {
    await api(`/challenges/${challengeId}/join`, post({ inviteCode }));
    toast.success("Challenge accepted!");
    mutate(`/challenges/${challengeId}`);
    mutate("/wallet");
    mutate(isCacheKey("/challenges"));
  } catch (e: any) {
    if (e.message === "Already joined") toast.warning("Already joined.");
    else if (e.message?.includes("own challenge")) {
      toast.error("Cannot join your own challenge.");
    } else toast.error(e.message || "Failed to join.");
    throw e;
  }
}

export async function submitResult(challengeId: string, data: any) {
  try {
    await api(`/challenges/${challengeId}/result`, post(data));
    toast.success("Result submitted!");
    mutate(`/challenges/${challengeId}`);
  } catch (e: any) {
    toast.error(e.message);
    throw e;
  }
}

export async function createChallenge(data: any) {
  try {
    const result = await api("/challenges", post(data));
    toast.success("Challenge created!");
    mutate(isCacheKey("/challenges"));
    mutate("/wallet");
    return result;
  } catch (e: any) {
    toast.error(e.message);
    throw e;
  }
}

export async function uploadPayment(data: FormData) {
  try {
    const result = await api("/payments", { method: "POST", body: data });
    toast.success("Payment proof uploaded!");
    return result;
  } catch (e: any) {
    toast.error(e.message);
    throw e;
  }
}

export async function requestWithdrawal(data: any) {
  try {
    await api("/wallet/withdraw", post(data));
    toast.success("Withdrawal requested!");
    mutate("/wallet");
  } catch (e: any) {
    toast.error(e.message);
    throw e;
  }
}
