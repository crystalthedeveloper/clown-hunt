
// components/WelcomeScreen.tsx

import React, { useEffect, useState } from "react";
import { fetchLeaderboardSnapshot, LeaderboardSnapshotEntry } from "../store/SupabaseLeaderboard";
import "../css/WelcomeScreen.css";

interface WelcomeScreenProps {
  onStart: () => void;
  onSignOut: () => void;
  userName: string | null;
  isGuest?: boolean;
}

const resolveDisplayName = (name: string | null, isGuest?: boolean): string => {
  if (!name) return "Player";
  if (isGuest) return name.trim() || "Guest";
  const trimmed = name.trim();
  const [first] = trimmed.split(/\s+/);
  return first || "Player";
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onSignOut, userName, isGuest }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [topKills, setTopKills] = useState<number | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snapshot = await fetchLeaderboardSnapshot();
        if (!active) return;

        const ranked = snapshot
          .filter((entry) => Number.isFinite(entry.kills))
          .sort((a, b) => {
            const rankA = typeof a.rank === "number" ? a.rank : Infinity;
            const rankB = typeof b.rank === "number" ? b.rank : Infinity;
            if (rankA !== rankB) return rankA - rankB;
            return (b.kills ?? 0) - (a.kills ?? 0);
          });

        const topEntry: LeaderboardSnapshotEntry | undefined = ranked[0];
        setTopKills(topEntry ? topEntry.kills : null);
      } catch {
        if (!active) return;
        setTopKills(null);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleStart = () => {
    setIsVisible(false);
    setTimeout(() => onStart(), 500);
  };

  return (
    <div className={`welcome-screen ${isVisible ? "fade-in" : "fade-out"}`}>
      <div className="welcome-box">
        <h1 className="welcome-box-header">
          Welcome, <span className="username">{resolveDisplayName(userName, isGuest)}</span>
        </h1>
        <p>Prepare for Clown Hunt FPS.</p>
        {typeof topKills === "number" && topKills > 0 && (
          <p className="high-score-banner">
            Top kills: <strong>{topKills}</strong>
          </p>
        )}

        <div className="button-container">
          <button className="primary-button" onClick={handleStart}>
            Start Game
          </button>
          <button
            className="secondary-button"
            onClick={() => window.open("https://www.crystalthedeveloper.ca", "_blank")}
          >
            Corporate Site
          </button>
          <button className="signout-button" onClick={onSignOut}>
            {isGuest ? "Exit Guest" : "Sign Out"}
          </button>
          </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
