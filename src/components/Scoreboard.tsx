// components/Scoreboard.tsx
import { useEffect, useState } from "react";
import "../css/Scoreboard.css";

interface ScoreboardProps {
  userId?: string | null;
  isGuest?: boolean;
}

interface LeaderboardPlayerEntry {
  user_id?: string;
  id?: string;
  kills?: number;
  rank?: number;
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const Scoreboard = ({ userId, isGuest }: ScoreboardProps) => {
  const [kills, setKills] = useState(0);
  const [rank, setRank] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadProfileUrl = import.meta.env.VITE_AWS_LOAD_PLAYER_PROFILE_URL;
    const leaderboardUrl = import.meta.env.VITE_AWS_LEADERBOARD_URL;

    if (!userId || isGuest || !loadProfileUrl || !leaderboardUrl) {
      setKills(0);
      setRank(0);
      return;
    }

    const fetchStats = async () => {
      try {
        const profileRes = await fetch(loadProfileUrl, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ user_id: userId }),
        });
        if (!profileRes.ok) {
          throw new Error(`Profile request failed (${profileRes.status})`);
        }
        const profilePayload = await profileRes.json();
        const profile = profilePayload?.profile ?? profilePayload ?? {};

        const leaderboardRes = await fetch(leaderboardUrl);
        if (!leaderboardRes.ok) {
          throw new Error(`Leaderboard request failed (${leaderboardRes.status})`);
        }
        const leaderboard = await leaderboardRes.json();

        const players: LeaderboardPlayerEntry[] = Array.isArray(leaderboard?.players)
          ? leaderboard.players
          : Array.isArray(leaderboard?.leaderboard)
          ? leaderboard.leaderboard
          : Array.isArray(leaderboard)
          ? leaderboard
          : [];

        const myEntry =
          players.find(
            (p) => String(p.user_id ?? p.id ?? "") === String(userId),
          ) ?? null;

        const killsValue = Number(profile?.kills) || 0;
        const rankValue = myEntry ? Number(myEntry.rank) || 0 : Number(profile?.rank) || 0;

        if (!cancelled) {
          setKills(killsValue);
          setRank(rankValue);
        }
      } catch (error) {
        console.error("Unable to load HUD stats:", error);
        if (!cancelled) {
          setKills(0);
          setRank(0);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId]);

  return (
    <div className="scoreboard">
      <div className="scoreboard-text">
        Kills: <div className="scoreboard-number">{kills}</div>
      </div>
      <div className="scoreboard-text">
        Rank: <div className="scoreboard-number">{rank}</div>
      </div>
    </div>
  );
};

export default Scoreboard;
