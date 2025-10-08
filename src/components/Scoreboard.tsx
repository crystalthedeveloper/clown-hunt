// components/Scoreboard.tsx

import { useGameStore } from "../store/store";
import "../css/Scoreboard.css";

const Scoreboard = () => {
  const kills = useGameStore((state) => state.kills);

  return (
    <div className="scoreboard">
      <div className="scoreboard-text">
        Clowns:{" "}
        <div className="scoreboard-number">{kills}</div>
      </div>
    </div>
  );
};

export default Scoreboard;
