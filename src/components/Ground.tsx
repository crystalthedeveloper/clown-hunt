// components/Ground.tsx
// This component represents the ground in the game. It creates a static ground plane using physics, 
// making it interactable with other objects, such as the player and obstacles.

import { useBox } from "@react-three/cannon";
import { useGameStore } from "../store/store"; // ✅ Fetch `groundSize` from Zustand
import * as THREE from "three";
import { GROUND_CENTER_Y, GROUND_THICKNESS } from "../config/world";

interface GroundProps {
  size?: [number, number];
}

export function Ground({ size }: GroundProps) {
  const groundSize = useGameStore((state) => state.groundSize); // ✅ Get from Zustand
  const finalSize = size ?? [groundSize, groundSize]; // ✅ Default to Zustand's size

  const [ref] = useBox<THREE.Mesh>(() => ({
    args: [finalSize[0], GROUND_THICKNESS, finalSize[1]], // Define the size of the ground
    position: [0, GROUND_CENTER_Y, 0], // ✅ Lowered to avoid player floating
    rotation: [0, 0, 0], // ✅ Ensures ground is flat
    type: "Static", // ✅ Make the ground a static object
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={[finalSize[0], GROUND_THICKNESS, finalSize[1]]} />
      <meshStandardMaterial
        color="#1f2022" // ✅ Dark color for the ground
        roughness={0.2} // ✅ Improved roughness for a more realistic surface
        metalness={0.3} // ✅ Reduced metalness to make it look less shiny
        envMapIntensity={0.8} // ✅ Slightly dimmed reflections
      />
    </mesh>
  );
}
