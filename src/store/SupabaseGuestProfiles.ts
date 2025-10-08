// src/store/SupabaseGuestProfiles.ts
import { supabase } from "./supabaseClient";

export interface GuestProfile {
  id: string;
  email: string;
  display_name: string | null;
  kills: number | null;
  player_rank: number | null;
}

const TABLE_NAME = "guest_profiles";
const SELECT_COLUMNS = "id, email, display_name, kills, player_rank";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const sanitizeName = (name?: string) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
};

export const SupabaseGuestProfiles = {
  async getByEmail(email: string) {
    const normalized = normalizeEmail(email);
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq("email", normalized)
      .maybeSingle<GuestProfile>();

    if (error) throw error;
    return data ?? null;
  },

  async upsertProfile(email: string, name?: string) {
    const normalized = normalizeEmail(email);
    const cleanedName = sanitizeName(name);

    const existing = await this.getByEmail(normalized);
    if (existing) {
      if (cleanedName && cleanedName !== existing.display_name) {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .update({ display_name: cleanedName })
          .eq("id", existing.id)
          .select(SELECT_COLUMNS)
          .single<GuestProfile>();
        if (error) throw error;
        return { profile: data, created: false as const };
      }
      return { profile: existing, created: false as const };
    }

    const payload = {
      email: normalized,
      display_name: cleanedName,
      kills: 0,
      player_rank: null,
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select(SELECT_COLUMNS)
      .single<GuestProfile>();

    if (error) throw error;
    return { profile: data, created: true as const };
  },

  async updateKills(email: string, kills: number, name?: string, rank?: number | null) {
    const normalized = normalizeEmail(email);
    const cleanedName = sanitizeName(name);

    const { profile: existing, created } = await this.upsertProfile(normalized, cleanedName ?? undefined);

    const currentBest = existing.kills ?? 0;
    const nextBest = Math.max(0, kills);
    const shouldUpdateName = cleanedName && cleanedName !== existing.display_name;
    const shouldUpdateKills = nextBest !== currentBest;

    const shouldUpdateRank = typeof rank === "number" && rank !== existing.player_rank;

    if (!shouldUpdateName && !shouldUpdateKills && !shouldUpdateRank && !created) {
      return existing;
    }

    const updatePayload: Partial<GuestProfile> = {};
    if (shouldUpdateKills) updatePayload.kills = nextBest;
    if (shouldUpdateName) updatePayload.display_name = cleanedName;
    if (typeof rank === "number") updatePayload.player_rank = rank;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("id", existing.id)
      .select(SELECT_COLUMNS)
      .single<GuestProfile>();

    if (error) throw error;
    return data;
  },
};

export type GuestProfileResult = Awaited<ReturnType<typeof SupabaseGuestProfiles.upsertProfile>>;
