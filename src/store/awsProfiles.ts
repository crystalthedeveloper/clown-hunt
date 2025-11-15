// src/store/awsProfiles.ts

export interface PlayerProfilePayload {
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  kills: number;
  rank?: number | null;
}

export interface GuestProfilePayload {
  guest_id: string;
  email?: string | null;
  first_name?: string | null;
  kills: number;
  rank?: number | null;
}

export interface PlayerProfileResult {
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  kills?: number | null;
  rank?: number | null;
}

export interface GuestProfileResult {
  guest_id: string;
  email?: string | null;
  first_name?: string | null;
  kills?: number | null;
  rank?: number | null;
}

export interface LeaderboardEntry {
  id: string;
  type: "player" | "guest";
  name: string;
  kills: number;
  rank: number;
}

interface AwsLeaderboardPayload {
  status?: string;
  leaderboard?: Array<{
    id: string;
    type: "player" | "guest";
    first_name?: string | null;
    kills?: number | null;
    rank?: number | null;
  }>;
  message?: string;
}

interface AwsProfileResponse<T> {
  status?: string;
  profile?: T;
  message?: string;
}

const AWS_ENDPOINTS = {
  savePlayerProfile: import.meta.env.VITE_AWS_SAVE_PLAYER_PROFILE_URL,
  loadPlayerProfile: import.meta.env.VITE_AWS_LOAD_PLAYER_PROFILE_URL,
  saveGuestProfile: import.meta.env.VITE_AWS_SAVE_GUEST_PROFILE_URL,
  loadGuestProfile: import.meta.env.VITE_AWS_LOAD_GUEST_PROFILE_URL,
  leaderboard: import.meta.env.VITE_AWS_LEADERBOARD_URL,
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response from AWS Lambda");
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Unable to parse AWS response: ${(error as Error).message}`);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AWS request failed with status ${response.status}`);
  }

  return parseJson<T>(response);
}

function getEndpoint(key: keyof typeof AWS_ENDPOINTS, label: string): string | null {
  const url = AWS_ENDPOINTS[key];
  if (!url) {
    console.error(`❌ Missing AWS endpoint for ${label}. Check environment variables.`);
    return null;
  }
  return url;
}

export async function savePlayerStatsAWS(payload: PlayerProfilePayload): Promise<boolean> {
  const url = getEndpoint("savePlayerProfile", "save_player_profile");
  if (!url) return false;

  try {
    const result = await postJson<AwsProfileResponse<PlayerProfileResult>>(url, payload);
    const succeeded = !result.status || result.status === "success";
    if (!succeeded) {
      console.error("❌ AWS save_player_profile rejected request:", result.message);
    }
    return succeeded;
  } catch (error) {
    console.error("❌ Failed to save player stats via AWS:", error);
    return false;
  }
}

export async function loadPlayerStatsAWS(userId: string): Promise<PlayerProfileResult | null> {
  const url = getEndpoint("loadPlayerProfile", "load_player_profile");
  if (!url) return null;

  try {
    const result = await postJson<AwsProfileResponse<PlayerProfileResult>>(url, { user_id: userId });
    if (result.status === "success" && result.profile) {
      return {
        user_id: result.profile.user_id,
        email: result.profile.email ?? null,
        first_name: result.profile.first_name ?? null,
        last_name: result.profile.last_name ?? null,
        kills: result.profile.kills ?? 0,
        rank: typeof result.profile.rank === "number" ? result.profile.rank : null,
      };
    }
    return null;
  } catch (error) {
    console.error("❌ Failed to load player stats via AWS:", error);
    return null;
  }
}

export async function saveGuestStatsAWS(payload: GuestProfilePayload): Promise<boolean> {
  const url = getEndpoint("saveGuestProfile", "save_guest_profile");
  if (!url) return false;

  try {
    const result = await postJson<AwsProfileResponse<GuestProfileResult>>(url, payload);
    const succeeded = !result.status || result.status === "success";
    if (!succeeded) {
      console.error("❌ AWS save_guest_profile rejected request:", result.message);
    }
    return succeeded;
  } catch (error) {
    console.error("❌ Failed to save guest stats via AWS:", error);
    return false;
  }
}

export async function loadGuestStatsAWS(guestId: string): Promise<GuestProfileResult | null> {
  const url = getEndpoint("loadGuestProfile", "load_guest_profile");
  if (!url) return null;

  try {
    const result = await postJson<AwsProfileResponse<GuestProfileResult>>(url, { guest_id: guestId });
    if (result.status === "success" && result.profile) {
      return {
        guest_id: result.profile.guest_id,
        email: result.profile.email ?? null,
        first_name: result.profile.first_name ?? null,
        kills: result.profile.kills ?? 0,
        rank: typeof result.profile.rank === "number" ? result.profile.rank : null,
      };
    }
    return null;
  } catch (error) {
    console.error("❌ Failed to load guest stats via AWS:", error);
    return null;
  }
}

export async function loadLeaderboardAWS(): Promise<LeaderboardEntry[]> {
  const url = getEndpoint("leaderboard", "leaderboard");
  if (!url) return [];

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Leaderboard request failed with status ${response.status}`);
    }
    const payload = await parseJson<AwsLeaderboardPayload>(response);
    if (!payload.leaderboard || payload.status === "error") {
      return [];
    }

    return payload.leaderboard
      .filter((entry) => Boolean(entry.id))
      .map((entry) => ({
        id: entry.id,
        type: entry.type ?? "player",
        name: entry.first_name?.trim() || "Player",
        kills: Number(entry.kills) || 0,
        rank: typeof entry.rank === "number" ? entry.rank : 0,
      }))
      .sort((a, b) => {
        if (a.rank && b.rank) {
          return a.rank - b.rank;
        }
        if (b.kills === a.kills) {
          return a.name.localeCompare(b.name);
        }
        return b.kills - a.kills;
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  } catch (error) {
    console.error("❌ Failed to load leaderboard via AWS:", error);
    return [];
  }
}
