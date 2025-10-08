// components/GameMenu.tsx
import { useEffect, useState } from "react";
import { useGameStore } from "../store/store";
import { SupabaseGuestProfiles } from "../store/SupabaseGuestProfiles";
import { SupabasePlayerStats } from "../store/SupabasePlayerStats";
import { SupabaseAuth } from "../store/SupabaseAuth";
import { fetchLeaderboardSnapshot, LeaderboardSnapshotEntry } from "../store/SupabaseLeaderboard";
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
  const userDataRaw = localStorage.getItem("guestProfile");
  const guestProfile = userDataRaw ? JSON.parse(userDataRaw) : null;
  const isGuest = Boolean(guestProfile);
  const userName = guestProfile?.fullName || null;
  const playerEmail = guestProfile?.email ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!isVisible) return;

    const loadRanks = async () => {
      setLoadingRank(true);
      try {
        const [snapshot, authUser] = await Promise.all([
          fetchLeaderboardSnapshot(),
          isGuest ? Promise.resolve(null) : SupabaseAuth.getUser(),
        ]);

        if (cancelled) return;

        const userId = authUser?.id ?? null;
        const lowerEmail = playerEmail?.toLowerCase() ?? null;

        const matchEntry = (entry: LeaderboardSnapshotEntry) =>
          (lowerEmail && entry.source === "guest" && entry.email?.toLowerCase() === lowerEmail) ||
          (userId && entry.source === "player" && entry.userId === userId);

        const existing = snapshot.find(matchEntry) ?? null;
        setCurrentRank(existing?.rank ?? null);

        const projectedList = [...snapshot];
        if (existing) {
          existing.kills = kills;
        } else {
          projectedList.push({
            name: userName || (isGuest ? "Guest" : "Player"),
            kills,
            rank: 0,
            source: isGuest ? "guest" : "player",
            userId: userId ?? undefined,
            email: playerEmail ?? undefined,
          });
        }

        projectedList.sort((a, b) => {
          if (b.kills === a.kills) {
            return a.name.localeCompare(b.name);
          }
          return b.kills - a.kills;
        });

        const newIndex = projectedList.findIndex(matchEntry);
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
  }, [isVisible, kills, isGuest, playerEmail, userName]);

  if (!isVisible) return null;

  const handleSaveProgress = async () => {
    setStatus("Saving progress…");
    setError("");
    try {
      const targetRank = projectedRank ?? currentRank ?? null;
      if (isGuest && guestProfile?.email) {
        await SupabaseGuestProfiles.updateKills(
          guestProfile.email,
          kills,
          userName ?? undefined,
          targetRank
        );
        const updated = {
          ...guestProfile,
          kills,
          player_rank: targetRank,
        };
        localStorage.setItem("guestProfile", JSON.stringify(updated));
      } else {
        await SupabasePlayerStats.savePlayerStats(kills, 0, "lose", targetRank ?? undefined);
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

    await SupabaseAuth.signOut();
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
