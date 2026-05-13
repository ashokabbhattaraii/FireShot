import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Singleton Supabase client used only for Realtime channels.
 * Anon key is fine — broadcast channels are signed by the API server.
 */
export function getRealtimeClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "[realtime] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set",
      );
    }
    return null;
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

export type RealtimeUnsubscribe = () => void;

export function subscribeToTournament(
  tournamentId: string,
  handlers: {
    onRoomPublished?: (payload: any) => void;
    onStatusChanged?: (payload: any) => void;
  },
): RealtimeUnsubscribe {
  const supa = getRealtimeClient();
  if (!supa) return () => {};
  const channel = supa.channel(`tournament:${tournamentId}`);
  if (handlers.onRoomPublished) {
    channel.on("broadcast", { event: "room_details_published" }, ({ payload }) =>
      handlers.onRoomPublished!(payload),
    );
  }
  if (handlers.onStatusChanged) {
    channel.on("broadcast", { event: "tournament_status_changed" }, ({ payload }) =>
      handlers.onStatusChanged!(payload),
    );
  }
  channel.subscribe();
  return () => {
    void supa.removeChannel(channel);
  };
}

export function subscribeToUser(
  userId: string,
  handlers: {
    onNotification?: (payload: any) => void;
    onPrizeCredited?: (payload: any) => void;
    onWalletUpdated?: (payload: any) => void;
    onChallengeMatched?: (payload: any) => void;
  },
): RealtimeUnsubscribe {
  const supa = getRealtimeClient();
  if (!supa) return () => {};
  const channel = supa.channel(`user:${userId}`);
  if (handlers.onNotification) {
    channel.on("broadcast", { event: "notification_new" }, ({ payload }) =>
      handlers.onNotification!(payload),
    );
  }
  if (handlers.onPrizeCredited) {
    channel.on("broadcast", { event: "prize_credited" }, ({ payload }) =>
      handlers.onPrizeCredited!(payload),
    );
  }
  if (handlers.onWalletUpdated) {
    channel.on("broadcast", { event: "wallet_updated" }, ({ payload }) =>
      handlers.onWalletUpdated!(payload),
    );
  }
  if (handlers.onChallengeMatched) {
    channel.on("broadcast", { event: "challenge_matched" }, ({ payload }) =>
      handlers.onChallengeMatched!(payload),
    );
  }
  channel.subscribe();
  return () => {
    void supa.removeChannel(channel);
  };
}
