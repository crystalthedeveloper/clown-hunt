// components/PlayerControls.tsx
// Provides an on-screen virtual trackpad centred near the bottom of the viewport plus a shoot
// button. The trackpad supports both pointer/touch dragging and keyboard controls (arrow keys or
// WASD) so that assistive technology users retain full access to movement.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/store";
import { BulletIcon } from "./ui/BulletIcon";
import "../css/PlayerControls.css";

interface PlayerControlsProps {
  onShoot: () => void;
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
const MAX_SPEED = 3.5;
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

const PlayerControls: React.FC<PlayerControlsProps> = ({ onShoot }) => {
  const setVelocity = useGameStore((state) => state.setVelocity);
  const setRotation = useGameStore((state) => state.setRotation);
  const bulletLevel = useGameStore((state) => state.bulletLevel);
  const bulletDamage = useGameStore((state) => state.bulletDamage);
  const bulletPulseToken = useGameStore((state) => state.bulletPulse);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const timeout = window.setTimeout(() => setPulse(false), 360);
    return () => window.clearTimeout(timeout);
  }, [bulletPulseToken, bulletLevel]);
  const trackpadIndicatorRef = useRef<HTMLDivElement | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const keyboardFrameRef = useRef<number | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastVelocityRef = useRef({ x: 0, z: 0 });

  const pointerStateRef = useRef<PointerState>({ ...INITIAL_POINTER_STATE });

  const applyVelocity = useCallback(
    (z: number) => {
      if (Math.abs(lastVelocityRef.current.z - z) < EPSILON) return;
      lastVelocityRef.current = { x: 0, z };
      setVelocity(0, z);
    },
    [setVelocity]
  );

  const resetIndicator = useCallback(() => {
    if (trackpadIndicatorRef.current) {
      trackpadIndicatorRef.current.style.transform = "translate3d(0px, 0px, 0)";
    }
  }, []);

  const applyIdleVelocity = useCallback(() => {
    if (!pointerStateRef.current.active && pressedKeysRef.current.size === 0) {
      applyVelocity(0);
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
  }, [applyIdleVelocity, resetIndicator]);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const startPointerLoop = useCallback(() => {
    if (pointerFrameRef.current !== null) return;

    const step = () => {
      const state = pointerStateRef.current;
      if (!state.active) {
        pointerFrameRef.current = null;
        return;
      }

      const deltaX = state.currentX - state.originX;
      const deltaY = state.currentY - state.originY;

      const moveFactorRaw = clamp(deltaY / MOVE_SENSITIVITY, -1, 1);
      const rotateFactorRaw = clamp(-deltaX / ROTATION_SENSITIVITY, -1, 1);

      const moveFactor = Math.abs(moveFactorRaw) < DEAD_ZONE ? 0 : moveFactorRaw;
      const rotateFactor = Math.abs(rotateFactorRaw) < DEAD_ZONE ? 0 : rotateFactorRaw;

      if (moveFactor !== 0) {
        applyVelocity(moveFactor * MAX_SPEED);
      } else if (pressedKeysRef.current.size === 0) {
        applyVelocity(0);
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
  }, [applyVelocity, setRotation]);

  const updateKeyboardMovement = useCallback(() => {
    const pressed = pressedKeysRef.current;
    if (pressed.size === 0) return;

    let moveZ = 0;
    let rotationChange = 0;

    if (pressed.has("arrowup") || pressed.has("w")) moveZ -= 1;
    if (pressed.has("arrowdown") || pressed.has("s")) moveZ += 1;
    if (pressed.has("arrowleft") || pressed.has("a")) rotationChange += 1;
    if (pressed.has("arrowright") || pressed.has("d")) rotationChange -= 1;

    if (moveZ !== 0) {
      applyVelocity(moveZ * MAX_SPEED);
    } else if (!pointerStateRef.current.active) {
      applyVelocity(0);
    }

    if (rotationChange !== 0) {
      setRotation((prev) => prev + rotationChange * ROTATION_STEP);
    }
  }, [applyVelocity, setRotation]);

  const startKeyboardLoop = useCallback(() => {
    if (keyboardFrameRef.current !== null) return;

    const step = () => {
      if (pressedKeysRef.current.size === 0) {
        keyboardFrameRef.current = null;
        return;
      }
      updateKeyboardMovement();
      keyboardFrameRef.current = requestAnimationFrame(step);
    };

    updateKeyboardMovement();
    keyboardFrameRef.current = requestAnimationFrame(step);
  }, [updateKeyboardMovement]);

  const stopKeyboardLoop = useCallback(() => {
    if (keyboardFrameRef.current !== null) {
      cancelAnimationFrame(keyboardFrameRef.current);
      keyboardFrameRef.current = null;
    }
    pressedKeysRef.current.clear();
    applyIdleVelocity();
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

  useEffect(() => {
    const handleShootKey = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        onShoot();
      }
    };

    window.addEventListener("keydown", handleShootKey);
    return () => window.removeEventListener("keydown", handleShootKey);
  }, [onShoot]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

  return (
    <div className="controls-bar">
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
      </div>

      {/* Shooting Button */}
      <div className="shoot-container">
        <button
          type="button"
          aria-label="Shoot"
          onMouseDown={onShoot}
          onTouchStart={onShoot}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onShoot();
            }
          }}
        >
          <BulletIcon damage={bulletDamage} pulse={pulse} />
        </button>
      </div>
    </div>
  );
};

export default PlayerControls;
