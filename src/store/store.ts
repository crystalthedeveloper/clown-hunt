// store/store.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { weaponConfigs } from "../config/weapons";

const CORRUPTION_BASE_RATE = 2.2; // % per second at wave 1
const CORRUPTION_WAVE_FACTOR = 0.45; // additional % per wave per second
const CORRUPTION_KILL_PENALTY = 14; // % removed per kill
const CORRUPTION_OVERFLOW_KILL_PENALTY = 10; // kills removed on overflow

type Position = [number, number, number];

interface Clown {
  id: number;
  position: Position;
  isAlive: boolean;
  health: number;
  state?: "alive" | "dying" | "removed";
  deathAnimation?: string;
}

interface PlayerState {
  velocity: { x: number; z: number };
  rotation: number;
  controlsLocked: boolean;
  movementSpeedMultiplier: number;
  setVelocity: (x: number, z: number) => void;
  setRotation: (rotation: number | ((prev: number) => number)) => void;
  resetMovement: () => void;
  setControlsLocked: (locked: boolean) => void;
  setMovementSpeedMultiplier: (value: number) => void;
}

interface GameState {
  kills: number;
  collectedLogos: number;
  totalLogos: number;
  totalClowns: number;
  totalBlackBoxes: number;
  totalDieBoxes: number;
  totalMovableBlackBoxes: number;
  groundSize: number;
  playerStartPosition: Position;
  currentWave: number;
  corruption: number;
  isPaused: boolean;
  isGameOver: boolean;
  gameResult: "win" | "lose" | null;
  clownData: Clown[];
  logoPositions: Position[];
  bulletLevel: number;
  bulletDamage: number;
  bulletPulse: number;
  profileKills: number | null;
  profileRank: number | null;
  killsLoaded: boolean;

  // Computed scores
  logoScore: number;
  killScore: number;

  // Actions
  setGameOver: (result: "win" | "lose") => void;
  killClown: () => number;
  increaseLogos: () => void;
  setCollectedLogos: (count: number | ((prev: number) => number)) => void;
  setClownData: (clowns: Clown[] | ((prev: Clown[]) => Clown[])) => void;
  setLogoPositions: (positions: Position[]) => void;
  setBulletLevel: (level: number) => void;
  upgradeBullet: () => void;
  setWave: (wave: number) => void;
  nextWave: () => number;
  tickCorruption: (delta: number) => { overflowed: boolean; wave: number };
  handleCorruptionOverflow: () => number;
  setPaused: (paused: boolean) => void;
  setProfileStats: (kills: number | null, rank: number | null) => void;
  resetProfileStats: () => void;
  resetGame: () => void;
}

export const useGameStore = create<PlayerState & GameState>()(
  subscribeWithSelector((set, get) => ({
    velocity: { x: 0, z: 0 },
    rotation: 0,
    controlsLocked: false,
    movementSpeedMultiplier: 1,

    groundSize: 60,
    playerStartPosition: [-15, 2, 15],
    totalBlackBoxes: 20,
    totalDieBoxes: 10,
    totalMovableBlackBoxes: 10,
    totalLogos: 25,
    totalClowns: 50,

    kills: 0,
    collectedLogos: 0,
    currentWave: 1,
    corruption: 0,
    isPaused: false,
    isGameOver: false,
    gameResult: null,
    clownData: [],
    logoPositions: [],
    bulletLevel: 0,
    bulletDamage: weaponConfigs[0]?.damage ?? 0,
    bulletPulse: 0,
    profileKills: null,
    profileRank: null,
    killsLoaded: false,

    // Computed values
    get logoScore() {
      return 0;
    },
    get killScore() {
      return get().kills;
    },

    setVelocity: (x, z) => set(() => ({ velocity: { x, z } })),
    setRotation: (rotationOrUpdater) =>
      set((state) => ({
        rotation:
          typeof rotationOrUpdater === "function"
            ? rotationOrUpdater(state.rotation)
            : rotationOrUpdater,
      })),
    resetMovement: () => set(() => ({ velocity: { x: 0, z: 0 }, rotation: 0 })),
    setControlsLocked: (locked) =>
      set((state) => ({
        controlsLocked: locked,
        velocity: locked ? { x: 0, z: 0 } : state.velocity,
      })),
    setMovementSpeedMultiplier: (value) =>
      set(() => ({
        movementSpeedMultiplier: Math.max(0.1, value),
      })),

    setGameOver: (result) =>
      set(() => ({
        isGameOver: true,
        isPaused: false,
        gameResult: result,
        velocity: { x: 0, z: 0 },
        rotation: 0,
        controlsLocked: true,
        movementSpeedMultiplier: 1,
      })),

    killClown: () => {
      let updatedKills = 0;
      set((state) => {
        updatedKills = state.kills + 1;
        const reducedCorruption = Math.max(0, state.corruption - CORRUPTION_KILL_PENALTY);
        return {
          kills: updatedKills,
          corruption: reducedCorruption,
        };
      });
      return updatedKills;
    },

    increaseLogos: () =>
      set((state) => ({
        collectedLogos: state.collectedLogos + 1,
      })),

    setCollectedLogos: (valueOrUpdater) =>
      set((state) => {
        const newCount =
          typeof valueOrUpdater === "function"
            ? valueOrUpdater(state.collectedLogos)
            : valueOrUpdater;

        return {
          collectedLogos: newCount,
        };
      }),

    setClownData: (valueOrUpdater) =>
      set((state) => ({
        clownData:
          typeof valueOrUpdater === "function"
            ? valueOrUpdater(state.clownData)
            : valueOrUpdater,
      })),

    setLogoPositions: (positions) => set(() => ({ logoPositions: positions })),
    setBulletLevel: (level) =>
      set((state) => {
        const clamped = Math.max(0, Math.min(Math.floor(level), weaponConfigs.length - 1));
        return {
          bulletLevel: clamped,
          bulletDamage: weaponConfigs[clamped]?.damage ?? 0,
          bulletPulse: state.bulletPulse + 1,
        };
      }),
    upgradeBullet: () => undefined,
    setProfileStats: (kills, rank) =>
      set(() => ({
        profileKills: kills,
        profileRank: rank,
        killsLoaded: true,
      })),
    resetProfileStats: () =>
      set(() => ({
        profileKills: null,
        profileRank: null,
        killsLoaded: false,
      })),

    setWave: (wave) =>
      set(() => ({
        currentWave: Math.max(1, Math.floor(wave)),
        corruption: 0,
      })),

    nextWave: () => {
      let newWave = 1;
      set((state) => {
        newWave = state.currentWave + 1;
        return {
          currentWave: newWave,
          corruption: 0,
        };
      });
      return newWave;
    },

    handleCorruptionOverflow: () => {
      let adjustedWave = 1;
      set((state) => {
        if (state.corruption < 100) {
          adjustedWave = state.currentWave;
          return {};
        }
        const penalizedKills = Math.max(0, state.kills - CORRUPTION_OVERFLOW_KILL_PENALTY);
        adjustedWave = Math.max(1, state.currentWave - 1);
        return {
          kills: penalizedKills,
          currentWave: adjustedWave,
          corruption: 0,
        };
      });
      return adjustedWave;
    },

    tickCorruption: (delta) => {
      let overflowed = false;
      set((state) => {
        if (state.isPaused) {
          return {};
        }
        if (state.isGameOver) {
          return {};
        }

        const hasLivingClown = state.clownData.some((clown) => clown.isAlive);
        if (!hasLivingClown) {
          if (state.corruption === 0) return {};
          return { corruption: 0 };
        }

        const rate = CORRUPTION_BASE_RATE + state.currentWave * CORRUPTION_WAVE_FACTOR;
        const increment = rate * delta;
        let nextValue = state.corruption + increment;
        if (nextValue >= 100) {
          overflowed = true;
          nextValue = 100;
        }
        return { corruption: nextValue };
      });

      if (overflowed) {
        const punishedWave = get().handleCorruptionOverflow();
        return { overflowed: true, wave: punishedWave };
      }

      return { overflowed: false, wave: get().currentWave };
    },

    setPaused: (paused) =>
      set((state) => ({
        isPaused: paused,
        controlsLocked: paused ? true : state.controlsLocked,
        velocity: paused ? { x: 0, z: 0 } : state.velocity,
      })),

    resetGame: () =>
      set((state) => ({
        kills: 0,
        collectedLogos: 0,
        currentWave: 1,
        corruption: 0,
        isPaused: false,
        isGameOver: false,
        gameResult: null,
        clownData: [],
        logoPositions: [],
        bulletLevel: 0,
        bulletDamage: weaponConfigs[0]?.damage ?? 0,
        bulletPulse: state.bulletPulse + 1,
        velocity: { x: 0, z: 0 },
        rotation: 0,
        movementSpeedMultiplier: 1,
        controlsLocked: false,
        totalLogos: state.totalLogos,
        totalClowns: state.totalClowns,
        totalBlackBoxes: state.totalBlackBoxes,
        totalDieBoxes: state.totalDieBoxes,
        totalMovableBlackBoxes: state.totalMovableBlackBoxes,
        profileKills: state.profileKills,
        profileRank: state.profileRank,
      })),
  }))
);
