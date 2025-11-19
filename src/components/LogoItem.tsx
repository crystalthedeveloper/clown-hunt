// components/LogoItem.tsx
// This component represents a collectible logo in the game. It creates a clone of a given logo model and 
// makes it interactable for the player. Once the player collects the logo by getting close, the logo disappears.

import React, { useRef } from "react";
import { useBox } from "@react-three/cannon";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { PlayerRef } from "./Player";
import { getWeaponConfig, weaponConfigs } from "../config/weapons";

// ✅ Load logo collection sound
const logoSound = new Audio("/logo.mp3");
logoSound.volume = 0.7;

interface LogoItemProps {
  playerRef: React.RefObject<PlayerRef>;
  position: [number, number, number];
  displayLevel: number;
  onCollect: (level: number) => void;
}

export function LogoItem({ playerRef, position, displayLevel, onCollect }: LogoItemProps) {
  const isCollected = useRef(false);
  const safeLevel = Math.max(1, Math.min(displayLevel, weaponConfigs.length));
  const displayIndex = safeLevel - 1;
  const displayDamage = getWeaponConfig(displayIndex).damage;

  const size: [number, number, number] = [0.8, 0.8, 0.8];

  const [ref, api] = useBox<THREE.Group>(() => ({
    mass: 1,
    type: "Static",
    position: [position[0], position[1] + size[1] / 2, position[2]],
    args: size,
    userData: { isCollectible: true },
  }));

  useFrame(() => {
    if (!ref.current || !playerRef.current || isCollected.current) return;

    const logoPos = new THREE.Vector3();
    ref.current.getWorldPosition(logoPos);

    const playerPos = playerRef.current.getPosition();

    if (logoPos.distanceTo(playerPos) < 1.5) {
      isCollected.current = true;

      logoSound.currentTime = 0;
      logoSound.play();

      onCollect(displayLevel);

      api.position.set(0, -100, 0);
      api.mass.set(0);
      ref.current.visible = false;
    }
  });

  const displayLabel =
    displayDamage <= 100
      ? "🤣"
      : displayDamage <= 200
      ? "🌊"
      : displayDamage <= 300
      ? "🍃"
      : displayDamage <= 500
      ? "🔥"
      : "💨";

  if (isCollected.current) return null;

  return (
    <group ref={ref} castShadow>
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.28}
        color="#f5f5f5"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {displayLabel}
      </Text>
    </group>
  );
}
