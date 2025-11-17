// components/Scoreboard.tsx
import "../css/Scoreboard.css";

interface ScoreboardProps {
  kills?: number;
  rank?: number;
}

const Scoreboard = ({ kills = 0, rank = 0 }: ScoreboardProps) => (
  <div className="scoreboard">
    <div className="scoreboard-text">
      Kills: <div className="scoreboard-number">{kills}</div>
    </div>
    <div className="scoreboard-text">
      Rank: <div className="scoreboard-number">{rank}</div>
    </div>
  </div>
);

export default Scoreboard;
