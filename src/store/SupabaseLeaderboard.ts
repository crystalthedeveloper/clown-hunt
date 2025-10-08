// src/store/SupabaseLeaderboard.ts
import { supabase } from "./supabaseClient";

export interface LeaderboardEntry {
  name: string;
  kills: number;
  rank: number;
  source: "player" | "guest";
}

interface PlayerRow {
  id: string;
  user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  kills?: number | null;
  player_rank?: number | null;
}

interface GuestRow {
  id: string;
  display_name?: string | null;
  email?: string | null;
  kills?: number | null;
  player_rank?: number | null;
}

const DEFAULT_LIMIT = 10;

export async function syncTopKillers(limit = DEFAULT_LIMIT): Promise<LeaderboardEntry[]> {
  try {
    const [{ data: playerStats, error: playerError }, { data: guestProfiles, error: guestError }] =
      await Promise.all([
        supabase
          .from("player_stats")
          .select("id, user_id, first_name, last_name, kills, player_rank")
          .order("created_at", { ascending: false }),
        supabase
          .from("guest_profiles")
          .select("id, email, display_name, kills, player_rank"),
      ]);

    if (playerError) {
      console.error("❌ Failed to fetch player stats for leaderboard:", playerError);
    }
    if (guestError) {
      console.error("❌ Failed to fetch guest profiles for leaderboard:", guestError);
    }

    const playerEntries = (playerStats as PlayerRow[] | null)?.map((row) => ({
      id: row.id,
      userId: row.user_id ?? null,
      email: null as string | null,
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Player",
      kills: Number(row.kills) || 0,
      previousRank: row.player_rank ?? null,
      source: "player" as const,
    })) ?? [];

    const guestEntries = (guestProfiles as GuestRow[] | null)?.map((row) => ({
      id: row.id,
      userId: null as string | null,
      email: row.email ?? null,
      name: row.display_name?.trim() || "Guest",
      kills: Number(row.kills) || 0,
      previousRank: row.player_rank ?? null,
      source: "guest" as const,
    })) ?? [];

    const combined = [...playerEntries, ...guestEntries].filter((entry) => entry.kills > 0);

    if (combined.length === 0) {
      return [];
    }

    combined.sort((a, b) => {
      if (b.kills === a.kills) {
        return a.name.localeCompare(b.name);
      }
      return b.kills - a.kills;
    });

    const ranked = combined.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    const playerUpdates = ranked
      .filter((entry) => entry.source === "player" && entry.previousRank !== entry.rank)
      .map((entry) =>
        supabase
          .from("player_stats")
          .update({ player_rank: entry.rank })
          .eq("id", entry.id)
      );

    const guestUpdates = ranked
      .filter((entry) => entry.source === "guest" && entry.previousRank !== entry.rank)
      .map((entry) =>
        supabase
          .from("guest_profiles")
          .update({ player_rank: entry.rank })
          .eq("id", entry.id)
      );

    if (playerUpdates.length || guestUpdates.length) {
      await Promise.allSettled([...playerUpdates, ...guestUpdates]);
    }

    return ranked.slice(0, limit).map(({ name, kills, rank, source }) => ({
      name,
      kills,
      rank,
      source,
    }));
  } catch (error) {
    console.error("❌ Failed to sync leaderboard:", error);
    return [];
  }
}

export interface LeaderboardSnapshotEntry extends LeaderboardEntry {
  userId?: string | null;
  email?: string | null;
}

export async function fetchLeaderboardSnapshot(): Promise<LeaderboardSnapshotEntry[]> {
  try {
    const [{ data: playerStats, error: playerError }, { data: guestProfiles, error: guestError }] =
      await Promise.all([
        supabase
          .from("player_stats")
          .select("id, user_id, first_name, last_name, kills, player_rank"),
        supabase
          .from("guest_profiles")
          .select("id, email, display_name, kills, player_rank"),
      ]);

    if (playerError) console.error("❌ Failed to fetch player stats snapshot:", playerError);
    if (guestError) console.error("❌ Failed to fetch guest profiles snapshot:", guestError);

    const playerEntries = (playerStats as PlayerRow[] | null)?.map((row) => ({
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Player",
      kills: Number(row.kills) || 0,
      rank: row.player_rank ?? null,
      source: "player" as const,
      userId: row.user_id ?? null,
      email: null,
    })) ?? [];

    const guestEntries = (guestProfiles as GuestRow[] | null)?.map((row) => ({
      name: row.display_name?.trim() || "Guest",
      kills: Number(row.kills) || 0,
      rank: row.player_rank ?? null,
      source: "guest" as const,
      userId: null,
      email: row.email ?? null,
    })) ?? [];

    const combined = [...playerEntries, ...guestEntries];

    combined.sort((a, b) => {
      if (b.kills === a.kills) {
        return a.name.localeCompare(b.name);
      }
      return b.kills - a.kills;
    });

    return combined.map((entry, index) => ({
      name: entry.name,
      kills: entry.kills,
      rank: index + 1,
      source: entry.source,
      userId: entry.userId,
      email: entry.email,
    }));
  } catch (error) {
    console.error("❌ Failed to fetch leaderboard snapshot:", error);
    return [];
  }
}
