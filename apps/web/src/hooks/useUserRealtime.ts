"use client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { subscribeToUser } from "@/lib/realtime";

interface Handlers {
  onNotification?: (payload: any) => void;
  onPrizeCredited?: (payload: any) => void;
  onWalletUpdated?: (payload: any) => void;
  onChallengeMatched?: (payload: any) => void;
}

/**
 * Subscribes to the current user's realtime channel for the lifetime
 * of the mounting component. No-op when logged out.
 */
export function useUserRealtime(handlers: Handlers) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToUser(user.id, handlers);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
