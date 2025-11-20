// components/GameMenu.tsx
import { useEffect, useState } from "react";
import { useGameStore } from "../store/store";
import type { SessionUser, StoredGuestProfile, StoredPlayerProfile } from "../types/user";
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
  playerRank?: number | null;
  user: SessionUser | null;
}

export function GameMenu({
  title,
  onRestart,
  isVisible,
  onVisitPortfolio,
  playerRank,
  user,
}: GameMenuProps) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [projectedRank, setProjectedRank] = useState<number | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const kills = useGameStore((state) => state.kills);
  const isGuest = Boolean(user?.isGuest);
  const profileId = user?.id ?? null;
  const userName = user?.fullName ?? null;
  const userType: "player" | "guest" = isGuest ? "guest" : "player";

  const playerRankOverride =
    typeof playerRank === "number" && Number.isFinite(playerRank) ? playerRank : null;

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
        const resolvedRank = newIndex >= 0 ? newIndex + 1 : null;
        setCurrentRank(resolvedRank ?? playerRankOverride ?? null);
        setProjectedRank(resolvedRank);
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
  }, [isVisible, kills, isGuest, profileId, userName, userType, playerRankOverride]);

  useEffect(() => {
    if (playerRankOverride !== null) {
      setCurrentRank(playerRankOverride);
    }
  }, [playerRankOverride]);

  if (!isVisible) return null;

  const handleSaveProgress = async () => {
    setStatus("Saving progress…");
    setError("");
    try {
      const targetRank = projectedRank ?? currentRank ?? null;
      if (!profileId || !user) {
        throw new Error("Profile unavailable. Please refresh and try again.");
      }

      if (isGuest) {
        await saveGuestStatsAWS({
          pk: "GUEST",
          guest_id: profileId,
          email: user.email,
          first_name: userName ?? "Guest",
          kills,
          rank: targetRank ?? undefined,
        });
        const updatedGuest: StoredGuestProfile = {
          id: profileId,
          email: user.email,
          fullName: userName ?? "Guest",
          kills,
          rank: targetRank ?? null,
        };
        localStorage.setItem("guestProfile", JSON.stringify(updatedGuest));
      } else {
        const resolvedFirstName =
          (user.firstName && user.firstName.trim()) ||
          (userName ? userName.split(/\s+/)[0] : null) ||
          "Player";
        const resolvedLastName =
          (user.lastName && user.lastName.trim()) ||
          (userName ? userName.split(/\s+/).slice(1).join(" ") : "") ||
          undefined;

        await savePlayerStatsAWS({
          pk: "PROFILE",
          user_id: profileId,
          email: user.email,
          first_name: resolvedFirstName,
          last_name: resolvedLastName,
          kills,
          rank: targetRank ?? undefined,
        });
        const updatedPlayer: StoredPlayerProfile = {
          id: profileId,
          email: user.email,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          kills,
          rank: targetRank ?? null,
        };
        localStorage.setItem("playerProfile", JSON.stringify(updatedPlayer));
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
            <span className="stat-value">#{currentRank ?? 1}</span>
          </div>
          <div className="stat-block">
            <span className="stat-label">New Rank if Saved</span>
            <span className="stat-value">#{projectedRank ?? currentRank ?? 1}</span>
          </div>
        </div>

        <button className="menu-button save-button" onClick={handleSaveProgress}>
          Save Progress
        </button>
        <button className="menu-button action-button" onClick={onRestart}>
          Restart
        </button>
        <button className="menu-button action-button" onClick={onVisitPortfolio}>
          Corporate Site
        </button>

        {loadingRank && <p className="status-message">Checking leaderboard…</p>}
        {status && <p className="status-message">{status}</p>}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default GameMenu;
