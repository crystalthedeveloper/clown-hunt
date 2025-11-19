// components/Ground.tsx
// This component represents the ground in the game. It creates a static ground plane using physics, 
// making it interactable with other objects, such as the player and obstacles.

import { useMemo } from "react";
import { useBox } from "@react-three/cannon";
import { useGameStore } from "../store/store";
import * as THREE from "three";
import { GROUND_CENTER_Y, GROUND_THICKNESS } from "../config/world";

interface GroundProps {
  size?: [number, number];
}

interface GroundTileProps {
  size: [number, number];
  position: [number, number, number];
}

function GroundTile({ size, position }: GroundTileProps) {
  const [ref] = useBox<THREE.Mesh>(() => ({
    args: [size[0], GROUND_THICKNESS, size[1]],
    position,
    rotation: [0, 0, 0],
    type: "Static",
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={[size[0], GROUND_THICKNESS, size[1]]} />
      <meshStandardMaterial color="black" roughness={0.65} metalness={0.1} />
    </mesh>
  );
}

export function Ground({ size }: GroundProps) {
  const groundSize = useGameStore((state) => state.groundSize);
  const finalSize = size ?? [groundSize, groundSize];

  const tiles = useMemo(() => {
    const segmentsPerAxis = 2;
    const spacingX = finalSize[0] / segmentsPerAxis;
    const spacingZ = finalSize[1] / segmentsPerAxis;
    const gap = 1;
    const tileSizeX = Math.max(1, spacingX - gap);
    const tileSizeZ = Math.max(1, spacingZ - gap);
    const halfWidth = finalSize[0] / 2;
    const halfDepth = finalSize[1] / 2;

    const entries: GroundTileProps[] = [];
    for (let i = 0; i < segmentsPerAxis; i += 1) {
      for (let j = 0; j < segmentsPerAxis; j += 1) {
        const centerX = -halfWidth + spacingX / 2 + i * spacingX;
        const centerZ = -halfDepth + spacingZ / 2 + j * spacingZ;
        entries.push({
          size: [tileSizeX, tileSizeZ],
          position: [centerX, GROUND_CENTER_Y, centerZ],
        });
      }
    }
    return entries;
  }, [finalSize]);

  return (
    <>
      {tiles.map((tile, index) => (
        <GroundTile key={index} size={tile.size} position={tile.position} />
      ))}
    </>
  );
}
