// components/GameCanvas.tsx
import { useRef, useEffect, useState, Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import { Html, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { Ground } from "./Ground";
import { Player, PlayerRef } from "./Player";
import PlayerControls from "./PlayerControls";
import { Clown } from "./Clown";
import { LogoItem } from "./LogoItem";
import { MovableBlackBox } from "./MovableBlackBox";
import { BlackBoxes } from "./BlackBoxes";
import { DieBoxes } from "./DieBoxes";
import Scoreboard from "./Scoreboard";
import { GameMenu } from "./GameMenu";
import { useGameStore } from "../store/store";
import { loadLeaderboardAWS } from "../store/awsProfiles";
import { weaponConfigs } from "../config/weapons";
import { GROUND_TOP } from "../config/world";

const PLAYER_PROFILE_URL =
  "https://1rdfzd1e59.execute-api.ca-central-1.amazonaws.com/prod/load_player_profile";
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

interface GameCanvasProps {
  userId?: string;
  isGuest?: boolean;
}

function GameCanvas({ userId, isGuest }: GameCanvasProps) {
  const playerRef = useRef<PlayerRef | null>(null);
  const bulletsRef = useRef<THREE.Mesh[]>([]);

  const setCollectedLogos = useGameStore((state) => state.setCollectedLogos);
  const increaseKills = useGameStore((state) => state.increaseKills);
  const isGameOver = useGameStore((state) => state.isGameOver);
  const setGameOver = useGameStore((state) => state.setGameOver);
  const resetGame = useGameStore((state) => state.resetGame);
  const setClownData = useGameStore((state) => state.setClownData);
  const logoPositions = useGameStore((state) => state.logoPositions);
  const setLogoPositions = useGameStore((state) => state.setLogoPositions);
  const clownData = useGameStore((state) => state.clownData);
  const totalLogos = useGameStore((state) => state.totalLogos);
  const totalBlackBoxes = useGameStore((state) => state.totalBlackBoxes);
  const totalDieBoxes = useGameStore((state) => state.totalDieBoxes);
  const totalMovableBlackBoxes = useGameStore((state) => state.totalMovableBlackBoxes);
  const groundSize = useGameStore((state) => state.groundSize);
  const playerStartPosition = useGameStore((state) => state.playerStartPosition);

  const { scene: clownModel, animations: clownAnimations } = useGLTF("/clown.glb");
  const { scene: logosModel } = useGLTF("/logos.glb");
  const logoChildrenCount = logosModel.children.length;

  const dieSound = new Audio("/die.mp3");
  dieSound.volume = 0.8;

  const clownsPerWave = 10;
  const baseWaveSpeed = 0.6;
  const waveSpeedIncrement = 0.18;

  const [currentWave, setCurrentWave] = useState(1);
  const [waveSpeedMultiplier, setWaveSpeedMultiplier] = useState(baseWaveSpeed);
  const spawnTimeoutRef = useRef<number | null>(null);
  const clownIdCounterRef = useRef(0);

  const environmentObstaclesRef = useRef<[number, number, number][]>([]);
  const totalScore = useGameStore((state) => state.killScore);
  const [leaderboardMilestones, setLeaderboardMilestones] = useState<{ place: number; score: number }[]>([]);
  const milestoneAchievedRef = useRef(new Set<number>());
  const [notifications, setNotifications] = useState<{ id: number; message: string }[]>([]);
  const notificationTimeoutsRef = useRef<Map<number, number>>(new Map());
  const setBulletLevel = useGameStore((state) => state.setBulletLevel);
  const [blackBoxPositions, setBlackBoxPositions] = useState<[number, number, number][]>([]);
  const [dieBoxPositions, setDieBoxPositions] = useState<[number, number, number][]>([]);
  const [movableBoxPositions, setMovableBoxPositions] = useState<[number, number, number][]>([]);
  const [playerHudStats, setPlayerHudStats] = useState<{ kills: number; rank: number }>({
    kills: 0,
    rank: 0,
  });

  useEffect(() => {
    if (!userId || isGuest) {
      setPlayerHudStats({ kills: 0, rank: 0 });
      return;
    }

    let cancelled = false;

    const loadPlayerStats = async () => {
      try {
        const profileRes = await fetch(PLAYER_PROFILE_URL, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ user_id: userId }),
        });
        if (!profileRes.ok) {
          throw new Error(`Profile request failed (${profileRes.status})`);
        }
        const payload = await profileRes.json();
        const profile = payload?.profile ?? payload ?? {};
        const kills = Number(profile?.kills) || 0;
        const rank = Number(profile?.rank) || 0;

        if (!cancelled) {
          setPlayerHudStats({ kills, rank });
        }
      } catch (error) {
        console.error("Failed to load player HUD stats:", error);
        if (!cancelled) {
          setPlayerHudStats({ kills: 0, rank: 0 });
        }
      }
    };

    loadPlayerStats();

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId]);

  const getHealthRangeForWave = useCallback((wave: number): [number, number] => {
    if (wave >= 5) {
      return [500, 600];
    }
    const tier = Math.max(1, Math.min(wave, 4));
    const min = tier * 100;
    return [min, min + 100];
  }, []);

  const getAvailableTiers = useCallback((wave: number): number[] => {
    if (wave >= 5) return [1, 2, 3, 4, 5, 6];
    if (wave >= 3) return [1, 2, 3, 4];
    return [1, 2];
  }, []);

  const generateUniquePositions = useCallback(
    (
      count: number,
      minDistanceFromPlayer = 5,
      minDistanceBetweenObjects = 5,
      yPosition = GROUND_TOP,
      existingObjects: [number, number, number][] = [],
      minVerticalDistance = 1
    ): [number, number, number][] => {
      const positions: [number, number, number][] = [];

      const distance3D = (a: [number, number, number], b: [number, number, number]) =>
        Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

      for (let i = 0; i < count; i += 1) {
        let selectedPosition: [number, number, number] | null = null;
        let fallbackPosition: [number, number, number] = [playerStartPosition[0], yPosition, playerStartPosition[2]];

        for (let attempts = 0; attempts < 1000; attempts += 1) {
          const candidate: [number, number, number] = [
            Math.random() * groundSize - groundSize / 2,
            yPosition,
            Math.random() * groundSize - groundSize / 2,
          ];
          fallbackPosition = candidate;

          const tooCloseToPlayer = distance3D(candidate, playerStartPosition) < minDistanceFromPlayer;
          const tooCloseToOthers = [...positions, ...existingObjects].some((existing) => {
            const closeXY = distance3D(existing, candidate) < minDistanceBetweenObjects;
            const overlapY = Math.abs(existing[1] - candidate[1]) < minVerticalDistance;
            return closeXY && overlapY;
          });

          if (!tooCloseToPlayer && !tooCloseToOthers) {
            selectedPosition = candidate;
            break;
          }
        }

        positions.push(selectedPosition ?? fallbackPosition);
      }

      return positions;
    },
    [groundSize, playerStartPosition]
  );

  const pushNotification = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message }]);
    const timeout = window.setTimeout(() => {
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
      notificationTimeoutsRef.current.delete(id);
    }, 3200);
    notificationTimeoutsRef.current.set(id, timeout);
  }, []);

  const spawnWave = useCallback(
    (waveNumber: number) => {
      if (waveNumber <= 1) {
        clownIdCounterRef.current = 0;
      }

      const environmentObstacles = environmentObstaclesRef.current;
      const positions = generateUniquePositions(clownsPerWave, 8, 6, GROUND_TOP, environmentObstacles);
      const [minHealth, maxHealth] = getHealthRangeForWave(waveNumber);

      const newClowns = positions.map((pos) => {
        const raw = Math.floor(Math.random() * (maxHealth - minHealth + 1)) + minHealth;
        const normalized = Math.round(raw / 50) * 50;
        return {
          id: clownIdCounterRef.current++,
          position: pos,
          isAlive: true,
          health: Math.min(600, Math.max(100, normalized)),
        };
      });

      const availableLogoPositions = generateUniquePositions(
        totalLogos,
        5,
        5,
        GROUND_TOP,
        [...environmentObstacles, ...positions],
      );

      setCurrentWave(waveNumber);
      setLogoPositions(availableLogoPositions);
      setClownData(newClowns);

      const multiplier = baseWaveSpeed + (waveNumber - 1) * waveSpeedIncrement;
      setWaveSpeedMultiplier(Math.max(baseWaveSpeed, multiplier));
    },
    [
      baseWaveSpeed,
      clownsPerWave,
      generateUniquePositions,
      getHealthRangeForWave,
      setClownData,
      setLogoPositions,
      totalLogos,
      waveSpeedIncrement,
    ],
  );

  const initializeGame = useCallback(() => {
    resetGame();
    milestoneAchievedRef.current.clear();
    setNotifications([]);
    setCurrentWave(1);
    setWaveSpeedMultiplier(baseWaveSpeed);
    if (spawnTimeoutRef.current !== null) {
      window.clearTimeout(spawnTimeoutRef.current);
      spawnTimeoutRef.current = null;
    }

    const blackBoxes = generateUniquePositions(totalBlackBoxes, 5, 5, GROUND_TOP);
    const dieBoxes = generateUniquePositions(totalDieBoxes, 5, 5, GROUND_TOP, blackBoxes);
    const movableBoxes = generateUniquePositions(
      totalMovableBlackBoxes,
      5,
      5,
      GROUND_TOP,
      [...blackBoxes, ...dieBoxes],
    );

    setBlackBoxPositions(blackBoxes);
    setDieBoxPositions(dieBoxes);
    setMovableBoxPositions(movableBoxes);

    environmentObstaclesRef.current = [...blackBoxes, ...dieBoxes, ...movableBoxes];

    spawnWave(1);
  }, [
    baseWaveSpeed,
    generateUniquePositions,
    resetGame,
    spawnWave,
    totalBlackBoxes,
    totalDieBoxes,
    totalLogos,
    totalMovableBlackBoxes,
  ]);

  const handlePlayerDie = () => {
    dieSound.currentTime = 0;
    dieSound.play().catch((e) => console.warn("❌ die.mp3 failed to play:", e));
    setGameOver("lose");
  };

  useEffect(() => {
    const timeouts = notificationTimeoutsRef.current;
    return () => {
      if (spawnTimeoutRef.current !== null) {
        window.clearTimeout(spawnTimeoutRef.current);
      }
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await loadLeaderboardAWS();
      if (!active) return;

      const fallbackKills = [150, 100, 60];
      const milestones = entries
        .filter((entry) => Number.isFinite(entry.kills) && entry.kills > 0)
        .sort((a, b) => b.kills - a.kills)
        .map((entry, index) => ({ place: index + 1, score: entry.kills }));

      for (let i = milestones.length; i < 3; i++) {
        milestones.push({ place: i + 1, score: fallbackKills[i] });
      }

      if (!milestones.length) {
        milestones.push(
          { place: 1, score: fallbackKills[0] },
          { place: 2, score: fallbackKills[1] },
          { place: 3, score: fallbackKills[2] }
        );
      }

      setLeaderboardMilestones(milestones.slice(0, 3));
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!leaderboardMilestones.length) return;

    leaderboardMilestones.forEach(({ place, score }) => {
      if (score <= 0) return;
      if (totalScore >= score && !milestoneAchievedRef.current.has(place)) {
        milestoneAchievedRef.current.add(place);
        const placeLabel = place === 1 ? "1st" : place === 2 ? "2nd" : "3rd";
        pushNotification(`🔥 You're now in ${placeLabel} place on the leaderboard!`);
      }
    });
  }, [leaderboardMilestones, pushNotification, totalScore]);

  const handleLogoCollect = useCallback(
    (tier: number) => {
      setCollectedLogos((prev) => prev + 1);
      const index = Math.max(0, Math.min(tier - 1, weaponConfigs.length - 1));
      setBulletLevel(index);
    },
    [setCollectedLogos, setBulletLevel]
  );

  const handleClownKill = useCallback(
    (id: number) => {
      let shouldSpawnNextWave = false;

      setClownData((prev) => {
        const updated = prev.map((c) => (c.id === id ? { ...c, isAlive: false } : c));
        if (updated.length && updated.every((c) => !c.isAlive)) {
          shouldSpawnNextWave = true;
        }
        return updated;
      });

      increaseKills();

      if (shouldSpawnNextWave) {
        const nextWave = currentWave + 1;
        if (spawnTimeoutRef.current !== null) {
          window.clearTimeout(spawnTimeoutRef.current);
        }
        spawnTimeoutRef.current = window.setTimeout(() => {
          spawnWave(nextWave);
        }, 850);
      }
    },
    [currentWave, increaseKills, setClownData, spawnWave]
  );

  const handleRestart = () => {
    initializeGame();
  };

  if (isGameOver) {
      return (
        <GameMenu
          title="💀 Game Over!"
          onRestart={handleRestart}
          isVisible={true}
          onVisitPortfolio={() => {
            window.open("https://www.crystalthedeveloper.ca", "_blank");
          }}
          playerRank={playerHudStats.rank}
        />
      );
  }

  const detectionRadius = Math.max(6, 14 - (currentWave - 1) * 1.1);
  const aggressionFactor = Math.min(3.5, 1 + (currentWave - 1) * 0.22);

  return (
    <>
      {notifications.length > 0 && (
        <div className="notification-stack">
          {notifications.map((notification) => (
            <div key={notification.id} className="notification-toast">
              {notification.message}
            </div>
          ))}
        </div>
      )}
      <Scoreboard kills={playerHudStats.kills} rank={playerHudStats.rank} />
      <Canvas shadows camera={{ position: [0, 10, 25], fov: 50 }} style={{ height: "100%", width: "100%" }}>
        <Suspense fallback={<Html center>Loading...</Html>}>
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#0a0a0a", 25, 120]} />
          <Environment files="/hdr/kloofendal_48d_partly_cloudy_puresky_4k.hdr" background backgroundIntensity={0.1} />
          <Physics gravity={[0, -80, 0]}>
            <Player ref={playerRef} bulletsRef={bulletsRef} onDie={handlePlayerDie} />
            <Ground size={[groundSize, groundSize]} />

            {clownData.map(
              (clown) =>
                clown.isAlive && (
                  <Clown
                    key={clown.id}
                    id={clown.id}
                    playerRef={playerRef}
                    bulletsRef={bulletsRef}
                    position={clown.position}
                model={clownModel}
                animations={clownAnimations}
                speedMultiplier={waveSpeedMultiplier}
                detectionRadius={detectionRadius}
                aggression={aggressionFactor}
                initialHealth={clown.health}
                onKill={handleClownKill}
                onCatch={handlePlayerDie}
              />
            )
        )}

            {logoPositions.map((position, index) => {
              const tiers = getAvailableTiers(currentWave);
              const tier = tiers[index % tiers.length];
              return (
                <LogoItem
                  key={index}
                  playerRef={playerRef}
                  position={[position[0], GROUND_TOP, position[2]]}
                  model={logosModel}
                  logoIndex={index % logoChildrenCount}
                  displayLevel={tier}
                  onCollect={handleLogoCollect}
                />
              );
            })}

            <BlackBoxes existingPositions={blackBoxPositions} />
            <DieBoxes existingPositions={dieBoxPositions} onPlayerDie={handlePlayerDie} />
            {movableBoxPositions.map((position, index) => (
              <MovableBlackBox
                key={index}
                position={position}
                size={[1.5, 1.5, 1.5]}
              />
            ))}
          </Physics>
        </Suspense>
      </Canvas>
      <PlayerControls onShoot={() => playerRef.current?.shoot()} />
    </>
  );
}

export default GameCanvas;
