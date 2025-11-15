// components/GameMenu.tsx
import { useEffect, useState } from "react";
import { useGameStore } from "../store/store";
import type { StoredGuestProfile, StoredPlayerProfile } from "../types/user";
import {
  loadLeaderboardAWS,
  saveGuestStatsAWS,
  savePlayerStatsAWS,
} from "../store/awsProfiles";
import "../css/GameMenu.css";

interface GameMenuProps {
  title: string;
  onRestart: () => void;
  isVisible: boolean;
  onVisitPortfolio: () => void;
}

export function GameMenu({
  title,
  onRestart,
  isVisible,
  onVisitPortfolio,
}: GameMenuProps) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [projectedRank, setProjectedRank] = useState<number | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const { kills } = useGameStore.getState();
  const guestProfileRaw = localStorage.getItem("guestProfile");
  const playerProfileRaw = localStorage.getItem("playerProfile");

  const guestProfile: StoredGuestProfile | null = guestProfileRaw
    ? (() => {
        try {
          return JSON.parse(guestProfileRaw);
        } catch {
          localStorage.removeItem("guestProfile");
          return null;
        }
      })()
    : null;

  const playerProfile: StoredPlayerProfile | null = playerProfileRaw
    ? (() => {
        try {
          return JSON.parse(playerProfileRaw);
        } catch {
          localStorage.removeItem("playerProfile");
          return null;
        }
      })()
    : null;

  const isGuest = Boolean(!playerProfile && guestProfile);
  const profileId = playerProfile?.id ?? guestProfile?.id ?? null;
  const userName = playerProfile
    ? [playerProfile.firstName, playerProfile.lastName].filter(Boolean).join(" ").trim() || "Player"
    : guestProfile?.fullName || null;
  const userType: "player" | "guest" = playerProfile ? "player" : "guest";

  useEffect(() => {
    let cancelled = false;
    if (!isVisible) return;
    if (!profileId) {
      setCurrentRank(null);
      setProjectedRank(null);
      return;
    }

    const loadRanks = async () => {
      setLoadingRank(true);
      try {
        const leaderboard = await loadLeaderboardAWS();

        if (cancelled) return;

        const matchEntry = (entry: typeof leaderboard[number]) =>
          entry.type === userType && entry.id === profileId;

        const rankedEntries = leaderboard.map((entry) => ({ ...entry }));
        const existing = rankedEntries.find(matchEntry) ?? null;
        setCurrentRank(existing?.rank ?? null);

        if (existing) {
          existing.kills = kills;
        } else {
          rankedEntries.push({
            id: profileId,
            type: userType,
            name: userName || (isGuest ? "Guest" : "Player"),
            kills,
            rank: 0,
          });
        }

        rankedEntries.sort((a, b) => {
          if (b.kills === a.kills) {
            return a.name.localeCompare(b.name);
          }
          return b.kills - a.kills;
        });

        const newIndex = rankedEntries.findIndex(matchEntry);
        setProjectedRank(newIndex >= 0 ? newIndex + 1 : null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled) {
          setError(`❌ Unable to load ranks: ${message}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingRank(false);
        }
      }
    };

    loadRanks();

    return () => {
      cancelled = true;
    };
  }, [isVisible, kills, isGuest, profileId, userName, userType]);

  if (!isVisible) return null;

  const handleSaveProgress = async () => {
    setStatus("Saving progress…");
    setError("");
    try {
      const targetRank = projectedRank ?? currentRank ?? null;
      if (isGuest && guestProfile) {
        await saveGuestStatsAWS({
          guest_id: guestProfile.id,
          email: guestProfile.email,
          first_name: userName ?? "Guest",
          kills,
          rank: targetRank ?? undefined,
        });
        const updated: StoredGuestProfile = {
          ...guestProfile,
          fullName: userName ?? guestProfile.fullName,
          kills,
          rank: targetRank ?? guestProfile.rank ?? null,
        };
        localStorage.setItem("guestProfile", JSON.stringify(updated));
      } else if (playerProfile) {
        await savePlayerStatsAWS({
          user_id: playerProfile.id,
          email: playerProfile.email,
          first_name: playerProfile.firstName,
          last_name: playerProfile.lastName,
          kills,
          rank: targetRank ?? undefined,
        });
        const updated: StoredPlayerProfile = {
          ...playerProfile,
          kills,
          rank: targetRank ?? playerProfile.rank ?? null,
        };
        localStorage.setItem("playerProfile", JSON.stringify(updated));
      }
      if (typeof targetRank === "number") {
        setStatus(`Progress saved. Ranked #${targetRank}.`);
        setCurrentRank(targetRank);
        setProjectedRank(targetRank);
      } else {
        setStatus("Progress saved.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("");
      setError(`Failed to save: ${message}`);
    }
  };

  const handleSignOut = async () => {
    if (isGuest) {
      localStorage.removeItem("guestProfile");
      window.location.reload();
      return;
    }

    localStorage.removeItem("playerProfile");
    window.location.reload();
  };

  return (
    <div className="game-menu">
      <div className="game-menu-content">
        <h1 className="menu-title">{title}</h1>
        <div className="game-stats">
          <div className="stat-block">
            <span className="stat-label">Clowns Killed</span>
            <span className="stat-value">{kills}</span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Current Rank</span>
            <span className="stat-value">
              {currentRank ? `#${currentRank}` : "Unranked"}
            </span>
          </div>
          <div className="stat-block">
            <span className="stat-label">New Rank if Saved</span>
            <span className="stat-value">
              {projectedRank ? `#${projectedRank}` : "Unranked"}
            </span>
          </div>
        </div>

        <button className="menu-button save-button" onClick={handleSaveProgress}>
          Save Progress
        </button>
        <button className="menu-button action-button" onClick={onRestart}>
          Restart
        </button>
        <button
          className="menu-button action-button"
          onClick={onVisitPortfolio}
        >
          Corporate Site
        </button>
        <button className="menu-button signout-button" onClick={handleSignOut}>
          Sign Out
        </button>

        {loadingRank && <p className="status-message">Checking leaderboard…</p>}
        {status && <p className="status-message">{status}</p>}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default GameMenu;
