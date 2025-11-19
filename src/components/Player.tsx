// components/Player.tsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSphere } from "@react-three/cannon";
import * as THREE from "three";
import { useGameStore } from "../store/store";

export interface PlayerRef {
  getPosition: () => THREE.Vector3;
  getForward: () => THREE.Vector3;
  resetPosition: (coords: [number, number, number]) => void;
}

interface PlayerProps {
  onDie: (context: { attackerId: number | null; immediate?: boolean }) => void;
  isPowerActive: boolean;
  onPowerKill?: (clownId: number, options?: { lookAtPlayer?: boolean }) => void;
}

export const Player = forwardRef<PlayerRef, PlayerProps>(
  ({ onDie, isPowerActive, onPowerKill }, ref) => {
    const { velocity, rotation, clownData } = useGameStore();
    const playerStartPosition = useGameStore((state) => state.playerStartPosition);
    const { camera } = useThree();

    const [playerBodyRef, api] = useSphere<THREE.Mesh>(() => ({
      mass: 1,
      position: [playerStartPosition[0], playerStartPosition[1], playerStartPosition[2]],
      args: [0.5],
      type: "Dynamic",
      linearDamping: 0.05,
      angularDamping: 0.2,
      userData: { isPlayer: true },
    }));
    const verticalVelocityRef = useRef(0);

    useEffect(() => {
      const unsubscribe = api.velocity.subscribe((velocity) => {
        verticalVelocityRef.current = velocity[1];
      });
      return unsubscribe;
    }, [api.velocity]);

    useImperativeHandle(ref, () => ({
      getPosition: () => {
        const playerPosition = new THREE.Vector3();
        playerBodyRef.current?.getWorldPosition(playerPosition);
        return playerPosition;
      },
      getForward: () => {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyEuler(new THREE.Euler(0, rotation, 0));
        forward.normalize();
        return forward;
      },
      resetPosition: (coords: [number, number, number]) => {
        api.position.set(coords[0], coords[1], coords[2]);
        api.velocity.set(0, 0, 0);
      },
    }));

    useFrame(() => {
      if (!playerBodyRef.current) return;

      const playerRotation = new THREE.Euler(0, rotation, 0);
      const direction = new THREE.Vector3(0, 0, 1)
        .applyEuler(playerRotation)
        .multiplyScalar(velocity.z);

      const playerPosition = new THREE.Vector3();
      playerBodyRef.current.getWorldPosition(playerPosition);

      api.velocity.set(direction.x * 3, verticalVelocityRef.current, direction.z * 3);

      const cameraHeightOffset = 0.8;
      camera.position.set(playerPosition.x, playerPosition.y + cameraHeightOffset, playerPosition.z);
      camera.rotation.set(0, rotation, 0);
      const cameraTarget = new THREE.Vector3(0, 0, -1)
        .applyEuler(camera.rotation)
        .add(camera.position);
      camera.lookAt(cameraTarget);

      if (velocity.z === 0 && velocity.x === 0) {
        api.angularVelocity.set(0, 0, 0);
      }

      if (playerPosition.y < -2) {
        onDie({ attackerId: null, immediate: true });
      }

      for (const clown of clownData) {
        if (!clown.isAlive) continue;
        const clownPosition = new THREE.Vector3(...clown.position);
        if (playerPosition.distanceTo(clownPosition) < 1.2) {
          if (isPowerActive) {
            onPowerKill?.(clown.id, { lookAtPlayer: true });
          } else {
            onDie({ attackerId: clown.id });
          }
          break;
        }
      }
    });

    return (
      <mesh ref={playerBodyRef} />
    );
  }
);
