// components/BlackBoxs.tsx
// Static obstacle boxes rendered with the same basic material as movable boxes.

import { Mesh } from "three";
import { useBox } from "@react-three/cannon";

type BlackBoxProps = {
  position: [number, number, number];
  size?: [number, number, number];
};

export function BlackBox({ position, size = [2, 4, 2] }: BlackBoxProps) {
  const [ref] = useBox<Mesh>(() => ({
    mass: 1,
    type: "Static",
    position: [position[0], position[1] + size[1] / 2, position[2]],
    args: size,
    userData: { isObstacle: true },
  }));

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="black" roughness={0.65} metalness={0.1} />
    </mesh>
  );
}

type BlackBoxesProps = {
  existingPositions: [number, number, number][];
};

export function BlackBoxes({ existingPositions }: BlackBoxesProps) {
  return (
    <>
      {existingPositions.map((pos, index) => (
        <BlackBox key={index} position={pos} />
      ))}
    </>
  );
}
