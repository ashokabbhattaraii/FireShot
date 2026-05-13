"use client";
import { useEffect, useState } from "react";
import { subscribeToTournament } from "@/lib/realtime";

interface Options {
  onRoomPublished?: (payload: any) => void;
  onStatusChanged?: (payload: any) => void;
}

/**
 * Subscribes to a tournament's realtime channel.
 * Returns `roomJustPublished` flag that pulses true for 3 seconds
 * after the admin publishes room details — useful for highlight animations.
 */
export function useTournamentRealtime(tournamentId: string | null | undefined, opts: Options = {}) {
  const [roomJustPublished, setRoomJustPublished] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    const unsub = subscribeToTournament(tournamentId, {
      onRoomPublished: (payload) => {
        setRoomJustPublished(true);
        setTimeout(() => setRoomJustPublished(false), 3000);
        opts.onRoomPublished?.(payload);
      },
      onStatusChanged: (payload) => {
        opts.onStatusChanged?.(payload);
      },
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  return { roomJustPublished };
}
