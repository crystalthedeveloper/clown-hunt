//store/SupabasePlayerStats.ts

import { supabase } from "./supabaseClient";
import { SupabaseAuth } from "./SupabaseAuth";

export class SupabasePlayerStats {
  static async getAuthenticatedUser() {
    const session = await SupabaseAuth.refreshSession();
    if (!session) return null;

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) return null;

    return {
      userId: userData.user.id,
      firstName: userData.user.user_metadata?.first_name || "Player",
      lastName: userData.user.user_metadata?.last_name || "",
    };
  }

  static async trackLogin(): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser();
      if (!user) return false;

      const { error } = await supabase.from("player_stats").insert([
        {
          user_id: user.userId,
          first_name: user.firstName,
          last_name: user.lastName,
          logo: null,
          kills: null,
          game_result: null,
          created_at: new Date().toISOString(),
        },
      ]);

      return !error;
    } catch {
      return false;
    }
  }

  static async savePlayerStats(
    rawKills: number,
    rawLogos: number,
    gameResult: "win" | "lose",
    playerRank?: number | null
  ): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser();
      if (!user) return false;

      const killCount = Math.max(0, Math.floor(rawKills));
      const logoCount = Math.max(0, Math.floor(rawLogos));
      const { data: existingRow, error: existingError } = await supabase
        .from("player_stats")
        .select("id, kills, player_rank")
        .eq("user_id", user.userId)
        .maybeSingle<{ id: string; kills: number | null; player_rank: number | null }>();

      if (existingError) throw existingError;

      const currentBest = existingRow?.kills ?? 0;
      const nextKills = Math.max(currentBest, killCount);
      const nextRank =
        typeof playerRank === "number"
          ? playerRank
          : existingRow?.player_rank ?? null;

      const basePayload = {
        first_name: user.firstName,
        last_name: user.lastName,
        logo: logoCount,
        kills: nextKills,
        player_rank: nextRank,
        game_result: gameResult.toLowerCase(),
        updated_at: new Date().toISOString(),
      };

      if (existingRow) {
        const { error } = await supabase
          .from("player_stats")
          .update(basePayload)
          .eq("id", existingRow.id);
        return !error;
      }

      const insertPayload = {
        ...basePayload,
        user_id: user.userId,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("player_stats").insert([insertPayload]);
      return !error;
    } catch {
      return false;
    }
  }
}

export default SupabasePlayerStats;
