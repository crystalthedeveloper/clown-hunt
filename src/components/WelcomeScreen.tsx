import { useEffect, useState } from "react";
import { loadLeaderboardAWS } from "../store/awsProfiles";
import "../css/WelcomeScreen.css";

interface WelcomeScreenProps {
  onStart: () => void;
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

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, userName, isGuest }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [topKills, setTopKills] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const leaderboard = await loadLeaderboardAWS();
      if (!mounted) return;
      const topEntry = leaderboard[0];
      setTopKills(topEntry?.kills ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleStart = () => {
    setIsVisible(false);
    window.setTimeout(() => onStart(), 450);
  };

  return (
    <div className={`welcome-screen ${isVisible ? "fade-in" : "fade-out"}`}>
      <div className="welcome-box">
        <h1 className="welcome-box-header">Welcome, {resolveDisplayName(userName, isGuest)}</h1>
        <p>Prepare for Clown Hunt.</p>
        {typeof topKills === "number" && topKills > 0 && (
          <div className="game-stats">
            <div className="stat-block">
              <span className="stat-label">Leaderboard Top</span>
              <span className="stat-value">{topKills}</span>
            </div>
          </div>
        )}

        <div className="welcome-actions">
          <button className="menu-button save-button" onClick={handleStart}>
            Start Game
          </button>
          <button
            className="menu-button action-button"
            onClick={() => window.open("https://www.crystalthedeveloper.ca", "_blank")}
          >
            Corporate Site
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
