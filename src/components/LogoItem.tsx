// components/LogoItem.tsx
// This component represents a collectible logo in the game. It creates a clone of a given logo model and 
// makes it interactable for the player. Once the player collects the logo by getting close, the logo disappears.

import React, { useRef, useMemo } from "react";
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
  model: THREE.Group;
  logoIndex: number;
  displayLevel: number;
  onCollect: (level: number) => void;
}

export function LogoItem({
  playerRef,
  position,
  model,
  logoIndex,
  displayLevel,
  onCollect,
}: LogoItemProps) {
  const isCollected = useRef(false);
  const displayIndex = Math.max(0, Math.min(displayLevel, weaponConfigs.length) - 1);
  const displayDamage = getWeaponConfig(displayIndex).damage;

  const clonedLogo = useMemo(() => {
    const clone = model.clone(true);

    const validChildren: THREE.Object3D[] = [];
    clone.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        validChildren.push(child);
      }
    });

    const selectedChild = validChildren[logoIndex];
    if (!selectedChild) {
      return new THREE.Group();
    }

    const wrapper = new THREE.Group();
    const logoMesh = selectedChild.clone();
    wrapper.add(logoMesh);

    const box = new THREE.Box3().setFromObject(wrapper);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    wrapper.position.sub(center);

    const scaleFactor = 0.8 / Math.max(size.x, size.y, size.z);
    wrapper.scale.setScalar(scaleFactor);

    const adjustedHeight = size.y * scaleFactor;
    wrapper.position.y += (0.4 - adjustedHeight) / 2;

    return wrapper;
  }, [model, logoIndex]);

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

  return !isCollected.current ? (
    <group ref={ref} castShadow receiveShadow>
      <Text
        position={[0, 0.6, 0]}
        fontSize={0.22}
        color="#f5f5f5"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="black"
      >
        {displayDamage}
      </Text>

      <primitive object={clonedLogo} />
    </group>
  ) : null;
}
