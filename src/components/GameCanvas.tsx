// components/GameCanvas.tsx
import { useRef, useEffect, useState, Suspense, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import { Html, Environment, useGLTF } from "@react-three/drei";

import { Ground } from "./Ground";
import { Player, PlayerRef } from "./Player";
import PlayerControls from "./PlayerControls";
import { Clown, DyingClown } from "./Clown";
import { LogoItem } from "./LogoItem";
import { LogoShowcase } from "./LogoShowcase";
import { MovableBlackBox } from "./MovableBlackBox";
import { BlackBoxes } from "./BlackBoxes";
import { DieBoxes } from "./DieBoxes";
import { GameMenu } from "./GameMenu";
import { useGameStore } from "../store/store";
import { loadLeaderboardAWS } from "../store/awsProfiles";
import { weaponConfigs } from "../config/weapons";
import { GROUND_TOP } from "../config/world";
import type { SessionUser } from "../types/user";

interface GameCanvasProps {
  user: SessionUser;
}

function GameCanvas({ user }: GameCanvasProps) {
  const playerRef = useRef<PlayerRef | null>(null);

  const setCollectedLogos = useGameStore((state) => state.setCollectedLogos);
  const killClownStat = useGameStore((state) => state.killClown);
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
  const setControlsLocked = useGameStore((state) => state.setControlsLocked);
  const setMovementSpeedMultiplier = useGameStore((state) => state.setMovementSpeedMultiplier);
  const setWave = useGameStore((state) => state.setWave);
  const advanceWave = useGameStore((state) => state.nextWave);
  const isPaused = useGameStore((state) => state.isPaused);
  const playerRank = useGameStore((state) => state.profileRank);

  const { scene: clownModel, animations: clownAnimations } = useGLTF("/clown.glb");
  const playerDieAnimationDurationMs = useMemo(() => {
    const clip = clownAnimations.find((entry) =>
      entry.name?.toLowerCase?.().includes("player_die"),
    );
    return Math.round((clip?.duration ?? 2.4) * 1000);
  }, [clownAnimations]);
  const deathSequenceDurationMs = playerDieAnimationDurationMs + 350;

  const dieSound = useMemo(() => {
    const audio = new Audio("/die.mp3");
    audio.volume = 0.8;
    return audio;
  }, []);

  const waveAdvanceSound = useMemo(() => {
    const audio = new Audio("/logo.mp3");
    audio.volume = 0.7;
    return audio;
  }, []);

  const clownsPerWave = 10;
  const baseWaveSpeed = 0.6;
  const waveSpeedIncrement = 0.18;

  const [waveSpeedMultiplier, setWaveSpeedMultiplier] = useState(baseWaveSpeed);
  const spawnTimeoutRef = useRef<number | null>(null);
  const clownIdCounterRef = useRef(0);
  const gameOverTimeoutRef = useRef<number | null>(null);

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
  const [logoGeneration, setLogoGeneration] = useState(0);
  const [sessionId, setSessionId] = useState(0);
  const powerTimeoutRef = useRef<number | null>(null);
  const powerIntervalRef = useRef<number | null>(null);
  const powerExpiryRef = useRef(0);
  const pausedPowerRemainingRef = useRef<number | null>(null);
  const [powerDurationMs, setPowerDurationMs] = useState(0);
  const [powerTimerMs, setPowerTimerMs] = useState(0);
  const [powerTier, setPowerTier] = useState(0);
  const [playerDeathAnimationClown, setPlayerDeathAnimationClown] = useState<number | null>(null);
  const [dyingClowns, setDyingClowns] = useState<
    Array<{ id: string; position: [number, number, number]; animation: string; lookAtTarget?: [number, number, number] }>
  >([]);
  const isPowerActive = powerTimerMs > 0;
  const POWER_MOVEMENT_MULTIPLIER = 1.45;

  const stopPowerCountdown = useCallback(() => {
    if (powerTimeoutRef.current !== null) {
      window.clearTimeout(powerTimeoutRef.current);
      powerTimeoutRef.current = null;
    }
    if (powerIntervalRef.current !== null) {
      window.clearInterval(powerIntervalRef.current);
      powerIntervalRef.current = null;
    }
  }, []);

  const clearPowerTimers = useCallback(() => {
    stopPowerCountdown();
    powerExpiryRef.current = 0;
  }, [stopPowerCountdown]);

  const resetPowerState = useCallback(() => {
    clearPowerTimers();
    setPowerTimerMs(0);
    setPowerDurationMs(0);
    setPowerTier(0);
    powerExpiryRef.current = 0;
  }, [clearPowerTimers]);

  const startPowerTimer = useCallback(
    (duration: number, options?: { preserveDuration?: boolean }) => {
      if (duration <= 0) return;
      const preserveDuration = options?.preserveDuration ?? false;
      stopPowerCountdown();
      if (!preserveDuration) {
        setPowerDurationMs(duration);
      }
      powerExpiryRef.current = Date.now() + duration;
      setPowerTimerMs(duration);

      powerTimeoutRef.current = window.setTimeout(() => {
        setBulletLevel(0);
        resetPowerState();
      }, duration);

      powerIntervalRef.current = window.setInterval(() => {
        if (useGameStore.getState().isPaused) return;
        const remaining = Math.max(0, powerExpiryRef.current - Date.now());
        setPowerTimerMs(remaining);
        if (remaining <= 0 && powerIntervalRef.current !== null) {
          window.clearInterval(powerIntervalRef.current);
          powerIntervalRef.current = null;
        }
      }, 80);
    },
    [resetPowerState, setBulletLevel, setPowerDurationMs, setPowerTimerMs, stopPowerCountdown]
  );
  useEffect(() => {
    const ratio =
      powerDurationMs > 0 ? Math.max(0, Math.min(1, powerTimerMs / powerDurationMs)) : 0;
    document.documentElement.style.setProperty("--power-border-progress", ratio.toString());
  }, [powerDurationMs, powerTimerMs]);

  useEffect(() => {
    setMovementSpeedMultiplier(isPowerActive ? POWER_MOVEMENT_MULTIPLIER : 1);
  }, [isPowerActive, setMovementSpeedMultiplier]);

  useEffect(() => {
    if (isPaused) {
      pausedPowerRemainingRef.current = powerTimerMs > 0 ? powerTimerMs : null;
      stopPowerCountdown();
    } else if (pausedPowerRemainingRef.current !== null) {
      startPowerTimer(pausedPowerRemainingRef.current, { preserveDuration: true });
      pausedPowerRemainingRef.current = null;
    }
  }, [isPaused, powerTimerMs, startPowerTimer, stopPowerCountdown]);
  useEffect(() => {
    if (playerDeathAnimationClown == null) return;
    const timeout = window.setTimeout(() => {
      setPlayerDeathAnimationClown(null);
    }, deathSequenceDurationMs);
    return () => window.clearTimeout(timeout);
  }, [deathSequenceDurationMs, playerDeathAnimationClown]);


  const getHealthRangeForWave = useCallback((wave: number): [number, number] => {
    if (wave >= 5) {
      return [500, 600];
    }
    const tier = Math.max(1, Math.min(wave, 4));
    const min = tier * 100;
    return [min, min + 100];
  }, []);

  const getAvailableTiers = useCallback((): number[] => {
    return [1, 2, 3, 4, 5, 6];
  }, []);

  const generateUniquePositions = useCallback(
    (
      count: number,
      minDistanceFromPlayer = 10,
      minDistanceBetweenObjects = 20,
      yPosition = GROUND_TOP,
      existingObjects: [number, number, number][] = [],
      minVerticalDistance = 1
    ): [number, number, number][] => {
      const positions: [number, number, number][] = [];

      const distance3D = (a: [number, number, number], b: [number, number, number]) =>
        Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

      const usableRadius = groundSize * 0.5;
      const jitterRadius = groundSize * 0.4;
      const gapBuffer = 1.5;
      const maxCoord = groundSize * 0.5 - 2;
      const clampAxis = (value: number) => {
        if (Math.abs(value) < gapBuffer) {
          const direction = value >= 0 ? 1 : -1;
          return direction * gapBuffer;
        }
        return Math.max(-maxCoord, Math.min(maxCoord, value));
      };
      const clampToPlayArea = (x: number, z: number) => {
        return [clampAxis(x), yPosition, clampAxis(z)] as [number, number, number];
      };
      const randomLocation = () => {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * usableRadius;
        return [Math.cos(angle) * distance, yPosition, Math.sin(angle) * distance] as [number, number, number];
      };

      for (let i = 0; i < count; i += 1) {
        let selectedPosition: [number, number, number] | null = null;
        let fallbackPosition: [number, number, number] = randomLocation();

        for (let attempts = 0; attempts < 1000; attempts += 1) {
          const center = randomLocation();
          const angle = Math.random() * Math.PI * 2;
          const radiusBias = Math.sqrt(Math.random());
          const offset = radiusBias * jitterRadius;
          const candidate = clampToPlayArea(center[0] + Math.cos(angle) * offset, center[2] + Math.sin(angle) * offset);
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

const getDeathAnimation = (tier: number): string => {
  if (tier >= 5) return "die_three";
  if (tier >= 3) return "die_two";
  if (tier >= 2) return "die_two";
  return "die_one";
};

const pushNotification = (
  message: string,
  setNotifications: React.Dispatch<React.SetStateAction<{ id: number; message: string }[]>>,
  notificationTimeoutsRef: React.MutableRefObject<Map<number, number>>,
) => {
  const id = Date.now() + Math.random();
  setNotifications((prev) => [...prev, { id, message }]);
  const timeout = window.setTimeout(() => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    notificationTimeoutsRef.current.delete(id);
  }, 3200);
  notificationTimeoutsRef.current.set(id, timeout);
};

const CorruptionTicker = ({ onOverflow, paused }: { onOverflow: (wave: number) => void; paused: boolean }) => {
  const tickCorruption = useGameStore((state) => state.tickCorruption);
  useFrame((_, delta) => {
    if (paused) return;
    const { overflowed, wave } = tickCorruption(delta);
    if (overflowed) {
      onOverflow(wave);
    }
  });
  return null;
};

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
          state: "alive" as const,
        };
      });

      const availableLogoPositions = generateUniquePositions(
        totalLogos,
        5,
        5,
        GROUND_TOP,
        [...environmentObstacles, ...positions],
      );

      setWave(waveNumber);
      setLogoPositions(availableLogoPositions);
      setLogoGeneration((prev) => prev + 1);
      setCollectedLogos(0);
      setClownData(newClowns);

      const multiplier = baseWaveSpeed + (waveNumber - 1) * waveSpeedIncrement;
      setWaveSpeedMultiplier(Math.max(baseWaveSpeed, multiplier));
    },
    [
      baseWaveSpeed,
      clownsPerWave,
      generateUniquePositions,
      getHealthRangeForWave,
      setWave,
      setCollectedLogos,
      setClownData,
      setLogoPositions,
      setLogoGeneration,
      totalLogos,
      waveSpeedIncrement,
    ],
  );

  const initializeGame = useCallback(() => {
    resetGame();
    resetPowerState();
    milestoneAchievedRef.current.clear();
    setNotifications([]);
    setWave(1);
    setWaveSpeedMultiplier(baseWaveSpeed);
    if (spawnTimeoutRef.current !== null) {
      window.clearTimeout(spawnTimeoutRef.current);
      spawnTimeoutRef.current = null;
    }
    clearPowerTimers();

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
    clearPowerTimers,
    generateUniquePositions,
    resetGame,
    resetPowerState,
    spawnWave,
    setWave,
    totalBlackBoxes,
    totalDieBoxes,
    totalLogos,
    totalMovableBlackBoxes,
  ]);

  const handlePlayerDie = useCallback(({ attackerId, immediate }: { attackerId: number | null; immediate?: boolean }) => {
    if ((isPowerActive && !immediate) || isGameOver || gameOverTimeoutRef.current !== null) {
      return;
    }
    setControlsLocked(true);
    setPlayerDeathAnimationClown(attackerId);
    dieSound.currentTime = 0;
    dieSound.play().catch((e) => console.warn("❌ die.mp3 failed to play:", e));
    if (attackerId === null || immediate) {
      setGameOver("lose");
      return;
    }
    const delay = Math.max(1500, deathSequenceDurationMs);
    gameOverTimeoutRef.current = window.setTimeout(() => {
      setGameOver("lose");
      gameOverTimeoutRef.current = null;
    }, delay);
  }, [deathSequenceDurationMs, dieSound, isGameOver, isPowerActive, setControlsLocked, setGameOver]);

  useEffect(() => {
    const timeouts = notificationTimeoutsRef.current;
    return () => {
      if (spawnTimeoutRef.current !== null) {
        window.clearTimeout(spawnTimeoutRef.current);
      }
      if (gameOverTimeoutRef.current !== null) {
        window.clearTimeout(gameOverTimeoutRef.current);
        gameOverTimeoutRef.current = null;
      }
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    initializeGame();

    return () => {
      clearPowerTimers();
    };
  }, [clearPowerTimers, initializeGame]);

  useEffect(() => {
    if (isGameOver) {
      resetPowerState();
    }
  }, [isGameOver, resetPowerState]);

  useEffect(() => {
    const palettes: Record<number, { color: string; glow: string; gradient: string }> = {
      0: { color: "rgba(255,255,255,0.35)", glow: "rgba(255,255,255,0.12)", gradient: "none" },
      2: { color: "rgba(0,163,255,0.95)", glow: "rgba(0,163,255,0.35)", gradient: "radial-gradient(circle at center, rgba(0,163,255,0.18), transparent 55%)" },
      3: { color: "rgba(15,231,87,0.95)", glow: "rgba(15,231,87,0.38)", gradient: "radial-gradient(circle at center, rgba(15,231,87,0.2), transparent 55%)" },
      4: { color: "rgba(255,153,0,0.95)", glow: "rgba(255,153,0,0.45)", gradient: "radial-gradient(circle at center, rgba(255,153,0,0.22), transparent 55%)" },
      5: { color: "rgba(255,255,255,0.95)", glow: "rgba(255,255,255,0.5)", gradient: "radial-gradient(circle at center, rgba(255,255,255,0.25), transparent 55%)" },
      6: { color: "rgba(255,255,255,0.95)", glow: "rgba(255,255,255,0.5)", gradient: "radial-gradient(circle at center, rgba(255,255,255,0.25), transparent 55%)" },
    };
    const palette = palettes[powerTier] ?? palettes[0];
    document.documentElement.style.setProperty("--power-border-color", palette.color);
    document.documentElement.style.setProperty("--power-border-glow", palette.glow);
    document.documentElement.style.setProperty("--power-border-gradient", palette.gradient);
  }, [powerTier]);

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
        pushNotification(`🔥 You're now in ${placeLabel} place on the leaderboard!`, setNotifications, notificationTimeoutsRef);
      }
    });
  }, [leaderboardMilestones, totalScore]);

  const handleLogoCollect = useCallback(
    (tier: number) => {
      const prevCollected = useGameStore.getState().collectedLogos;
      const nextCollected = prevCollected + 1;
      setCollectedLogos(nextCollected);

      if (nextCollected >= totalLogos) {
        const refreshedLogos = generateUniquePositions(
          totalLogos,
          5,
          5,
          GROUND_TOP,
          environmentObstaclesRef.current,
        );
        setLogoPositions(refreshedLogos);
        setLogoGeneration((prev) => prev + 1);
        setCollectedLogos(0);
      }
      if (tier <= 1) {
        setBulletLevel(0);
        resetPowerState();
        return;
      }

      const index = Math.max(0, Math.min(tier - 1, weaponConfigs.length - 1));
      setBulletLevel(index);
      setPowerTier(tier);

      const duration = Math.max(6000, 3000 * tier);
      startPowerTimer(duration);
    },
    [
      generateUniquePositions,
      resetPowerState,
      setBulletLevel,
      setCollectedLogos,
      setLogoGeneration,
      setLogoPositions,
      setPowerTier,
      startPowerTimer,
      totalLogos,
    ]
  );

  const handleClownKill = useCallback(
    (id: number, options?: { lookAtPlayer?: boolean }) => {
      let shouldSpawnNextWave = false;
      const animation = getDeathAnimation(powerTier);
      let dyingPosition: [number, number, number] | null = null;
      let lookAtTarget: [number, number, number] | undefined;

      setClownData((prev) => {
        const updated = prev.map((c) => {
          if (c.id === id) {
            dyingPosition = c.position;
            return { ...c, isAlive: false, state: "removed" as const, deathAnimation: animation };
          }
          return c;
        });
        if (updated.length && updated.every((c) => !c.isAlive)) {
          shouldSpawnNextWave = true;
        }
        return updated;
      });

      const totalKills = killClownStat();
      if (totalKills % 10 === 0) {
        const level = totalKills / 10 + 1;
        pushNotification(`⚔️ Wave ${level} reached!`, setNotifications, notificationTimeoutsRef);
        waveAdvanceSound.currentTime = 0;
        waveAdvanceSound.play();
        const refreshedLogos = generateUniquePositions(
          totalLogos,
          5,
          5,
          GROUND_TOP,
          environmentObstaclesRef.current,
        );
        setLogoPositions(refreshedLogos);
        setLogoGeneration((prev) => prev + 1);
        setCollectedLogos(0);
        setPowerTier(0);
        setPowerTimerMs(0);
        clearPowerTimers();
      }

      if (dyingPosition) {
        if (options?.lookAtPlayer && playerRef.current) {
          const playerPosition = playerRef.current.getPosition();
          lookAtTarget = [playerPosition.x, playerPosition.y, playerPosition.z];
        }
        setDyingClowns((prev) => [
          ...prev,
          { id: `${id}-${Date.now()}`, position: dyingPosition!, animation, lookAtTarget },
        ]);
      }

      if (shouldSpawnNextWave) {
        const waveToSpawn = advanceWave();
        if (spawnTimeoutRef.current !== null) {
          window.clearTimeout(spawnTimeoutRef.current);
        }
        spawnTimeoutRef.current = window.setTimeout(() => {
          spawnWave(waveToSpawn);
        }, 850);
      }
    },
    [
      advanceWave,
      generateUniquePositions,
      waveAdvanceSound,
      killClownStat,
      playerRef,
      powerTier,
      setClownData,
      setCollectedLogos,
      setLogoGeneration,
      setLogoPositions,
      spawnWave,
      totalLogos,
    ]
  );

  const handleOverflowRespawn = useCallback(
    (wave: number) => {
      if (isGameOver) return;
      if (spawnTimeoutRef.current !== null) {
        window.clearTimeout(spawnTimeoutRef.current);
        spawnTimeoutRef.current = null;
      }
      pushNotification(
        `☣️ Corruption overload! Falling back to Wave ${wave}.`,
        setNotifications,
        notificationTimeoutsRef,
      );
      spawnWave(wave);
    },
    [isGameOver, notificationTimeoutsRef, setNotifications, spawnWave]
  );

  const handleRestart = () => {
    if (gameOverTimeoutRef.current !== null) {
      window.clearTimeout(gameOverTimeoutRef.current);
      gameOverTimeoutRef.current = null;
    }
    clearPowerTimers();
    resetPowerState();
    setControlsLocked(false);
    setPlayerDeathAnimationClown(null);
    initializeGame();
    playerRef.current?.resetPosition?.(playerStartPosition);
    setSessionId((prev) => prev + 1);
  };

  const handleDeathComplete = useCallback((entryId: string) => {
    setDyingClowns((prev) => prev.filter((entry) => entry.id !== entryId));
  }, []);

  return (
    <>
      {isGameOver && (
        <GameMenu
          title="💀 Game Over!"
          onRestart={handleRestart}
          isVisible={true}
          onVisitPortfolio={() => {
            window.open("https://www.crystalthedeveloper.ca", "_blank");
          }}
          playerRank={playerRank}
          user={user}
        />
      )}
      {notifications.length > 0 && (
        <div className="notification-stack">
          {notifications.map((notification) => (
            <div key={notification.id} className="notification-toast">
              {notification.message}
            </div>
          ))}
        </div>
      )}
      <Canvas
        key={sessionId}
        shadows
        camera={{ position: [0, 10, 25], fov: 50 }}
        style={{ height: "100%", width: "100%" }}
      >
        <Suspense fallback={<Html center>Loading...</Html>}>
          <color attach="background" args={["#000000"]} />
          <fog attach="fog" args={["#0a0a0a", 25, 120]} />
          <Environment files="/hdr/kloofendal_48d_partly_cloudy_puresky_4k.hdr" background backgroundIntensity={0.1} />
          <Physics gravity={[0, -48, 0]}>
            <CorruptionTicker onOverflow={handleOverflowRespawn} paused={isPaused} />
            <Player
              ref={playerRef}
              onDie={handlePlayerDie}
              isPowerActive={isPowerActive}
              onPowerKill={handleClownKill}
            />
            <Ground size={[groundSize, groundSize]} />
            <LogoShowcase />

            {clownData
              .filter((clown) => clown.isAlive)
              .map((clown) => {
                const isKillingPlayer = playerDeathAnimationClown === clown.id;
                const lookTarget =
                  isKillingPlayer && playerRef.current
                    ? playerRef.current.getPosition()
                    : null;
                return (
                  <Clown
                    key={clown.id}
                    playerRef={playerRef}
                    position={[clown.position[0], clown.position[1], clown.position[2]]}
                    model={clownModel}
                    animations={clownAnimations}
                    speedMultiplier={waveSpeedMultiplier}
                    forcedAnimation={isKillingPlayer ? "player_die" : null}
                    deathLookTarget={lookTarget ? [lookTarget.x, lookTarget.y, lookTarget.z] : null}
                  />
                );
              })}

            {dyingClowns.map((entry) => (
              <DyingClown
                key={entry.id}
                id={entry.id}
                position={entry.position}
                model={clownModel}
                animations={clownAnimations}
                animationName={entry.animation}
                lookAtTarget={entry.lookAtTarget}
                onComplete={handleDeathComplete}
              />
            ))}

            {logoPositions.map((position, index) => {
              const tiers = getAvailableTiers();
              const tier = tiers[index % tiers.length];
              return (
                <LogoItem
                  key={`${logoGeneration}-${index}`}
                  playerRef={playerRef}
                  position={[position[0], GROUND_TOP + 0.1, position[2]]}
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
      <PlayerControls powerTimerMs={powerTimerMs} hideControls={playerDeathAnimationClown !== null} />
    </>
  );
}

export default GameCanvas;
