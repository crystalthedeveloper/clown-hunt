// components/MovableBlackBox.tsx
// This component creates a movable black box that reacts to player interaction. When the box is hit, it will move in the 3D world. 
// The box has damping applied to its movement and angular damping to prevent excessive spinning.

import { Mesh } from "three";
import { useMemo } from "react";
import { useBox } from "@react-three/cannon";

type MovableBlackBoxProps = {
  position: [number, number, number];
  size?: [number, number, number];
  floating?: boolean;
};

export function MovableBlackBox({ position, size = [1, 1, 1], floating = false }: MovableBlackBoxProps) {
  const scaledSize: [number, number, number] = [
    size[0] * 0.65,
    size[1] * 0.65,
    size[2] * 0.65,
  ];

  const initialPosition = useMemo<[number, number, number]>(() => {
    if (!floating) return position;
    return [position[0], position[1] + 2 + Math.random() * 3, position[2]];
  }, [floating, position]);

  const [ref] = useBox<Mesh>(() => ({
    mass: floating ? 0.4 : 1,
    position: [initialPosition[0], initialPosition[1] + scaledSize[1] / 2, initialPosition[2]],
    args: scaledSize,
    userData: { isObstacle: true },
    linearDamping: floating ? 0.2 : 0.5,
    angularDamping: 0.4,
  }));

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={scaledSize} />
      <meshStandardMaterial color="black" />
    </mesh>
  );
}
