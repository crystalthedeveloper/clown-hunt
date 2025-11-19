// components/PlayerControls.tsx
// Provides an on-screen virtual trackpad centred near the bottom of the viewport plus a shoot
// button. The trackpad supports both pointer/touch dragging and keyboard controls (arrow keys or
// WASD) so that assistive technology users retain full access to movement.

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useGameStore } from "../store/store";
import "../css/PlayerControls.css";

interface PlayerControlsProps {
  powerTimerMs: number;
  hideControls?: boolean;
}

interface PointerState {
  active: boolean;
  pointerId: number | null;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

const MOVE_SENSITIVITY = 100;
const ROTATION_SENSITIVITY = 200;
const BASE_MAX_SPEED = 3.5;
const ROTATION_STEP = 0.02;
const DEAD_ZONE = 0.12;
const INDICATOR_RANGE = 55;
const EPSILON = 0.001;

const MOVEMENT_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
]);

const INITIAL_POINTER_STATE: PointerState = {
  active: false,
  pointerId: null,
  originX: 0,
  originY: 0,
  currentX: 0,
  currentY: 0,
};

const PlayerControls: React.FC<PlayerControlsProps> = ({ powerTimerMs, hideControls = false }) => {
  const setVelocity = useGameStore((state) => state.setVelocity);
  const setRotation = useGameStore((state) => state.setRotation);
  const controlsLocked = useGameStore((state) => state.controlsLocked);
  const setControlsLockedStore = useGameStore((state) => state.setControlsLocked);
  const movementSpeedMultiplier = useGameStore((state) => state.movementSpeedMultiplier);
  const isGameOver = useGameStore((state) => state.isGameOver);
  const isPaused = useGameStore((state) => state.isPaused);
  const setPaused = useGameStore((state) => state.setPaused);
  const currentWave = useGameStore((state) => state.currentWave);
  const corruption = useGameStore((state) => state.corruption);
  const kills = useGameStore((state) => state.kills);
  const collectedLogos = useGameStore((state) => state.collectedLogos);
  const totalLogos = useGameStore((state) => state.totalLogos);
  const trackpadIndicatorRef = useRef<HTMLDivElement | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const keyboardFrameRef = useRef<number | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastVelocityRef = useRef({ x: 0, z: 0 });
  const lastMoveFactorRef = useRef(0);
  const movementMultiplierRef = useRef(movementSpeedMultiplier);

  const pointerStateRef = useRef<PointerState>({ ...INITIAL_POINTER_STATE });

  const applyVelocity = useCallback(
    (z: number) => {
      if (controlsLocked) {
        if (Math.abs(z) < EPSILON && Math.abs(lastVelocityRef.current.z) > EPSILON) {
          lastVelocityRef.current = { x: 0, z: 0 };
          setVelocity(0, 0);
        }
        return;
      }
      if (Math.abs(lastVelocityRef.current.z - z) < EPSILON) return;
      lastVelocityRef.current = { x: 0, z };
      setVelocity(0, z);
    },
    [controlsLocked, setVelocity]
  );

  const resetIndicator = useCallback(() => {
    if (trackpadIndicatorRef.current) {
      trackpadIndicatorRef.current.style.transform = "translate3d(0px, 0px, 0)";
    }
  }, []);

  const applyIdleVelocity = useCallback(() => {
    if (!pointerStateRef.current.active && pressedKeysRef.current.size === 0) {
      applyVelocity(0);
      lastMoveFactorRef.current = 0;
    }
  }, [applyVelocity]);

  const stopPointerLoop = useCallback(() => {
    if (pointerFrameRef.current !== null) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    pointerStateRef.current = { ...INITIAL_POINTER_STATE };
    resetIndicator();
    applyIdleVelocity();
    lastMoveFactorRef.current = 0;
  }, [applyIdleVelocity, resetIndicator]);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const startPointerLoop = useCallback(() => {
    if (pointerFrameRef.current !== null || controlsLocked) return;

    const step = () => {
      const state = pointerStateRef.current;
      if (!state.active || controlsLocked) {
        pointerFrameRef.current = null;
        return;
      }

      const deltaX = state.currentX - state.originX;
      const deltaY = state.currentY - state.originY;

      const moveFactorRaw = clamp(deltaY / MOVE_SENSITIVITY, -1, 1);
      const rotateFactorRaw = clamp(-deltaX / ROTATION_SENSITIVITY, -1, 1);

      const moveFactor = Math.abs(moveFactorRaw) < DEAD_ZONE ? 0 : moveFactorRaw;
      const rotateFactor = Math.abs(rotateFactorRaw) < DEAD_ZONE ? 0 : rotateFactorRaw;

      const maxSpeed = BASE_MAX_SPEED * movementMultiplierRef.current;

      if (moveFactor !== 0) {
        applyVelocity(moveFactor * maxSpeed);
        lastMoveFactorRef.current = moveFactor;
      } else if (pressedKeysRef.current.size === 0) {
        applyVelocity(0);
        lastMoveFactorRef.current = 0;
      }

      if (rotateFactor !== 0) {
        setRotation((prev) => prev + rotateFactor * ROTATION_STEP);
      }

      if (trackpadIndicatorRef.current) {
        const indicatorX = clamp(deltaX, -INDICATOR_RANGE, INDICATOR_RANGE);
        const indicatorY = clamp(deltaY, -INDICATOR_RANGE, INDICATOR_RANGE);
        trackpadIndicatorRef.current.style.transform = `translate3d(${indicatorX}px, ${indicatorY}px, 0)`;
      }
      pointerFrameRef.current = requestAnimationFrame(step);
    };

    step();
  }, [applyVelocity, controlsLocked, setRotation]);

  const updateKeyboardMovement = useCallback(() => {
    if (controlsLocked) return;
    const pressed = pressedKeysRef.current;
    if (pressed.size === 0) return;

    let moveZ = 0;
    let rotationChange = 0;

    if (pressed.has("arrowup") || pressed.has("w")) moveZ -= 1;
    if (pressed.has("arrowdown") || pressed.has("s")) moveZ += 1;
    if (pressed.has("arrowleft") || pressed.has("a")) rotationChange += 1;
    if (pressed.has("arrowright") || pressed.has("d")) rotationChange -= 1;

    const maxSpeed = BASE_MAX_SPEED * movementMultiplierRef.current;

    if (moveZ !== 0) {
      applyVelocity(moveZ * maxSpeed);
      lastMoveFactorRef.current = moveZ;
    } else if (!pointerStateRef.current.active) {
      applyVelocity(0);
      lastMoveFactorRef.current = 0;
    }

    if (rotationChange !== 0) {
      setRotation((prev) => prev + rotationChange * ROTATION_STEP);
    }
  }, [applyVelocity, controlsLocked, setRotation]);

  const startKeyboardLoop = useCallback(() => {
    if (keyboardFrameRef.current !== null || controlsLocked) return;

    const step = () => {
      if (pressedKeysRef.current.size === 0 || controlsLocked) {
        keyboardFrameRef.current = null;
        return;
      }
      updateKeyboardMovement();
      keyboardFrameRef.current = requestAnimationFrame(step);
    };

    updateKeyboardMovement();
    keyboardFrameRef.current = requestAnimationFrame(step);
  }, [controlsLocked, updateKeyboardMovement]);

  const stopKeyboardLoop = useCallback(() => {
    if (keyboardFrameRef.current !== null) {
      cancelAnimationFrame(keyboardFrameRef.current);
      keyboardFrameRef.current = null;
    }
    pressedKeysRef.current.clear();
    applyIdleVelocity();
    lastMoveFactorRef.current = 0;
  }, [applyIdleVelocity]);

  useEffect(() => {
    const disableContextMenu = (event: MouseEvent) => event.preventDefault();
    const disableSelection = (event: Event) => event.preventDefault();

    document.addEventListener("contextmenu", disableContextMenu);
    document.addEventListener("selectstart", disableSelection);
    document.addEventListener("mousedown", disableSelection);

    return () => {
      document.removeEventListener("contextmenu", disableContextMenu);
      document.removeEventListener("selectstart", disableSelection);
      document.removeEventListener("mousedown", disableSelection);
      stopPointerLoop();
      stopKeyboardLoop();
    };
  }, [stopKeyboardLoop, stopPointerLoop]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (controlsLocked) return;
    const state = pointerStateRef.current;
    if (state.active) return;

    pointerStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    startPointerLoop();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (controlsLocked) return;
    const state = pointerStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;

    pointerStateRef.current.currentX = event.clientX;
    pointerStateRef.current.currentY = event.clientY;
    event.preventDefault();
  };

  const handlePointerUpOrCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    stopPointerLoop();
  };

  const handleTrackpadKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (controlsLocked) return;
    const key = event.key.toLowerCase();
    if (!MOVEMENT_KEYS.has(key)) return;
    event.preventDefault();
    pressedKeysRef.current.add(key);
    startKeyboardLoop();
    resetIndicator();
  };

  const handleTrackpadKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (!MOVEMENT_KEYS.has(key)) return;
    event.preventDefault();
    pressedKeysRef.current.delete(key);
    if (pressedKeysRef.current.size === 0) {
      stopKeyboardLoop();
      resetIndicator();
    }
  };

  const handleTrackpadBlur = () => {
    stopKeyboardLoop();
    resetIndicator();
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (controlsLocked) return;
      const key = event.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) return;
      event.preventDefault();
      if (!pressedKeysRef.current.has(key)) {
        pressedKeysRef.current.add(key);
        startKeyboardLoop();
      }
    };

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (controlsLocked) return;
      const key = event.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) return;
      event.preventDefault();
      pressedKeysRef.current.delete(key);
      if (pressedKeysRef.current.size === 0) {
        stopKeyboardLoop();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [controlsLocked, startKeyboardLoop, stopKeyboardLoop]);

  useEffect(() => {
    if (!controlsLocked) return;
    pointerStateRef.current = { ...INITIAL_POINTER_STATE };
    pressedKeysRef.current.clear();
    resetIndicator();
    stopPointerLoop();
    stopKeyboardLoop();
    lastVelocityRef.current = { x: 0, z: 0 };
    lastMoveFactorRef.current = 0;
    setVelocity(0, 0);
  }, [controlsLocked, resetIndicator, setVelocity, stopKeyboardLoop, stopPointerLoop]);

  useEffect(() => {
    movementMultiplierRef.current = movementSpeedMultiplier;
  }, [movementSpeedMultiplier]);

  useEffect(() => {
    if (controlsLocked) return;
    const factor = lastMoveFactorRef.current;
    if (Math.abs(factor) < EPSILON) return;
    const newSpeed = factor * BASE_MAX_SPEED * movementSpeedMultiplier;
    lastVelocityRef.current = { x: 0, z: newSpeed };
    setVelocity(0, newSpeed);
  }, [controlsLocked, movementSpeedMultiplier, setVelocity]);

  const handlePauseToggle = () => {
    if (isGameOver) return;
    const next = !isPaused;
    setPaused(next);
    setControlsLockedStore(next);
    if (next) {
      applyVelocity(0);
      lastMoveFactorRef.current = 0;
    }
  };

  const corruptionPercent = Math.round(Math.min(100, corruption));
  const powerLabel = useMemo(() => {
    const powerSeconds = Math.ceil(Math.max(0, powerTimerMs) / 1000);
    return powerSeconds > 0 ? `${powerSeconds}s` : "Off";
  }, [powerTimerMs]);

  const isVisible = !isGameOver && !hideControls;

  return (
    <div className={`controls-bar${isVisible ? "" : " controls-bar--hidden"}`}>
      {/* Virtual Trackpad */}
      <div className="trackpad-container">
        <div
          className="trackpad-surface"
          tabIndex={0}
          role="application"
          aria-label="Movement trackpad. Drag or use arrow keys or WASD to move and rotate."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerLeave={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onKeyDown={handleTrackpadKeyDown}
          onKeyUp={handleTrackpadKeyUp}
          onBlur={handleTrackpadBlur}
        >
          <div ref={trackpadIndicatorRef} className="trackpad-thumb" />
        </div>
        <div className="trackpad-meta">
          <div className="trackpad-meta-header">
            <span className="trackpad-meta-label">Wave {currentWave}</span>
            <span className="trackpad-meta-stat trackpad-meta-kills">{kills}</span>
            <span className="trackpad-meta-stat trackpad-meta-logos">
              {collectedLogos}/{totalLogos}
            </span>
            <span className="trackpad-meta-stat trackpad-meta-power">{powerLabel}</span>
            <span className="trackpad-meta-corruption-value">{corruptionPercent}%</span>

          </div>
          <div className="trackpad-meta-bar">
            <div className="trackpad-meta-fill" style={{ width: `${corruptionPercent}%` }} />
          </div>
          <div className="trackpad-meta-caption">
            <span>Corruption Timer</span>
            <button className="trackpad-meta-pause" type="button" onClick={handlePauseToggle}>
              {isPaused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
