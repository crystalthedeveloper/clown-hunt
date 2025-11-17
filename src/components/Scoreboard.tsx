// components/Scoreboard.tsx
import { useGameStore } from "../store/store";
import "../css/Scoreboard.css";

interface ScoreboardProps {
  rank?: number | null;
}

const Scoreboard = ({ rank = 0 }: ScoreboardProps) => {
  const kills = useGameStore((state) => state.kills);

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
