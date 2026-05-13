import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight wrapper around Supabase Realtime broadcast channels.
 * Replaces a socket.io gateway for serverless deployments.
 *
 * Channels:
 *   tournament:{id}  → room_details_published, tournament_status_changed
 *   user:{id}        → notification_new, prize_credited, wallet_updated, challenge_matched
 *
 * All emits are best-effort: failures must never break the calling mutation.
 */
@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);
  private client: SupabaseClient | null = null;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      this.logger.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — realtime disabled");
      return;
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }

  private async send(channelName: string, event: string, payload: unknown) {
    if (!this.client) return;
    try {
      const channel = this.client.channel(channelName, { config: { broadcast: { ack: false } } });
      await channel.subscribe();
      await channel.send({ type: "broadcast", event, payload });
      // Detach immediately — serverless functions are short-lived
      await this.client.removeChannel(channel);
    } catch (err) {
      this.logger.warn(`realtime emit failed (${channelName}/${event}): ${(err as Error).message}`);
    }
  }

  emitToTournament(tournamentId: string, event: string, payload: unknown) {
    void this.send(`tournament:${tournamentId}`, event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    void this.send(`user:${userId}`, event, payload);
  }
}
