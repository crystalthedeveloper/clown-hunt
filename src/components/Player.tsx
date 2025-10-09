// components/Player.tsx
// This component defines the player character in a 3D game. The player is represented as a sphere and controlled by physics through react-three/fiber and react-three/cannon.
// It handles player movement, shooting, collision detection with clowns, fall detection, and bullet management.

// components/Player.tsx
import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSphere } from "@react-three/cannon";
import * as THREE from "three";
import { useGameStore } from "../store/store";
import { getWeaponConfig } from "../config/weapons";

const shootSound = new Audio("/single-shot.mp3");
shootSound.volume = 0.6;

const MUZZLE_FLASH_DURATION = 0.1;
const RECOIL_BASE = 0.02;
const RECOIL_DECAY = 7;
const CAMERA_SHAKE_DECAY = 6;
const CAMERA_SHAKE_STRENGTH_X = 0.05;
const CAMERA_SHAKE_STRENGTH_Y = 0.035;

export interface PlayerRef {
  shoot: () => void;
  getPosition: () => THREE.Vector3;
}

interface PlayerProps {
  onDie: () => void;
  bulletsRef: React.MutableRefObject<THREE.Mesh[]>;
}

export const Player = forwardRef<PlayerRef, PlayerProps>(
  ({ onDie, bulletsRef }, ref) => {
    const { velocity, rotation, clownData, bulletLevel } = useGameStore();
    const { camera, scene } = useThree();
    const weapon = getWeaponConfig(bulletLevel);

    const aimDotRef = useRef<THREE.Object3D | null>(null);
    const muzzleFlashLightRef = useRef<THREE.PointLight | null>(null);
    const muzzleFlashMeshRef = useRef<THREE.Mesh | null>(null);
    const muzzleFlashTimerRef = useRef(0);
    const recoilRef = useRef(0);
    const cameraShakeRef = useRef(0);
    const flashStrengthRef = useRef(weapon.flashIntensity);

    const [playerBodyRef, api] = useSphere<THREE.Mesh>(() => ({
      mass: 1,
      position: [0, 1, 0],
      args: [0.5],
      type: "Dynamic",
      linearDamping: 0.05,
      angularDamping: 0.2,
      userData: { isPlayer: true },
    }));

    useImperativeHandle(ref, () => ({
      shoot,
      getPosition: () => {
        const playerPosition = new THREE.Vector3();
        playerBodyRef.current?.getWorldPosition(playerPosition);
        return playerPosition;
      },
    }));

    useEffect(() => {
      const color = new THREE.Color(1, 1, 0).multiplyScalar(0.5); // brighter neon yellow
      const lineMaterial = new THREE.LineBasicMaterial({
        color,
        depthTest: false,
        transparent: true,
        opacity: 1,
      });

      const xShapeGeometry1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.05, 0.05, 0),
        new THREE.Vector3(0.05, -0.05, 0),
      ]);

      const xShapeGeometry2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.05, 0.05, 0),
        new THREE.Vector3(-0.05, -0.05, 0),
      ]);

      const line1 = new THREE.Line(xShapeGeometry1, lineMaterial);
      const line2 = new THREE.Line(xShapeGeometry2, lineMaterial);

      const cross = new THREE.Group();
      cross.add(line1);
      cross.add(line2);

      cross.renderOrder = 999; // ✅ force it on top
      cross.position.y += 0.001; // ✅ slight offset to prevent z-fighting

      aimDotRef.current = cross;
      scene.add(cross);

      return () => {
        scene.remove(cross);
        xShapeGeometry1.dispose();
        xShapeGeometry2.dispose();
        lineMaterial.dispose();
      };
    }, [scene]);

    useEffect(() => {
      const light = new THREE.PointLight("#ffeaa0", 0, 4, 2);
      light.visible = false;
      light.position.set(0, -0.05, -0.25);

      const flashGeometry = new THREE.SphereGeometry(0.08, 12, 12);
      const flashMaterial = new THREE.MeshBasicMaterial({
        color: "#ffe38a",
        transparent: true,
        opacity: 0,
      });
      const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
      flashMesh.visible = false;
      flashMesh.position.set(0, -0.08, -0.28);

      camera.add(light);
      camera.add(flashMesh);
      muzzleFlashLightRef.current = light;
      muzzleFlashMeshRef.current = flashMesh;

      return () => {
        camera.remove(light);
        camera.remove(flashMesh);
        flashGeometry.dispose();
        flashMaterial.dispose();
      };
    }, [camera]);

    useEffect(() => {
      flashStrengthRef.current = weapon.flashIntensity;
    }, [weapon.flashIntensity]);

    useFrame((state, delta) => {
      if (!playerBodyRef.current) return;

      const playerRotation = new THREE.Euler(0, rotation, 0);
      const direction = new THREE.Vector3(0, 0, 1)
        .applyEuler(playerRotation)
        .multiplyScalar(velocity.z);

      api.velocity.set(direction.x * 3, 0, direction.z * 3);

      const playerPosition = new THREE.Vector3();
      playerBodyRef.current.getWorldPosition(playerPosition);

      recoilRef.current = THREE.MathUtils.damp(recoilRef.current, 0, RECOIL_DECAY, delta);
      cameraShakeRef.current = Math.max(0, cameraShakeRef.current - delta * CAMERA_SHAKE_DECAY);

      camera.position.set(playerPosition.x, playerPosition.y + 0.5, playerPosition.z);
      camera.rotation.set(-recoilRef.current, rotation, 0);

      if (cameraShakeRef.current > 0) {
        const shake = cameraShakeRef.current;
        camera.position.x += Math.sin(state.clock.elapsedTime * 48) * shake * CAMERA_SHAKE_STRENGTH_X;
        camera.position.y += Math.cos(state.clock.elapsedTime * 52) * shake * CAMERA_SHAKE_STRENGTH_Y;
      }

      const cameraTarget = new THREE.Vector3(0, 0, -1)
        .applyEuler(camera.rotation)
        .add(camera.position);
      camera.lookAt(cameraTarget);

      if (aimDotRef.current) {
        const aimDir = new THREE.Vector3();
        camera.getWorldDirection(aimDir);
        const dotPosition = camera.position.clone().add(aimDir.multiplyScalar(2));
        aimDotRef.current.position.copy(dotPosition);
        aimDotRef.current.lookAt(camera.position);
      }

      if (velocity.z === 0 && velocity.x === 0) {
        api.angularVelocity.set(0, 0, 0);
      }

      if (playerPosition.y < -2) {
        onDie();
      }

      clownData.forEach((clown) => {
        if (!clown.isAlive) return;
        const clownPosition = new THREE.Vector3(...clown.position);
        if (playerPosition.distanceTo(clownPosition) < 1.2) {
          onDie();
        }
      });

      if (muzzleFlashTimerRef.current > 0) {
        muzzleFlashTimerRef.current = Math.max(0, muzzleFlashTimerRef.current - delta);
        const normalized = muzzleFlashTimerRef.current / MUZZLE_FLASH_DURATION;
        const light = muzzleFlashLightRef.current;
        const mesh = muzzleFlashMeshRef.current;
        if (light) {
          light.intensity = flashStrengthRef.current * normalized;
          light.visible = normalized > 0;
        }
        if (mesh) {
          mesh.visible = normalized > 0;
          const material = mesh.material as THREE.MeshBasicMaterial;
          material.opacity = 0.45 * normalized;
          const scale = 1 + (1 - normalized) * 0.8;
          mesh.scale.setScalar(scale);
        }
      } else {
        if (muzzleFlashLightRef.current) muzzleFlashLightRef.current.visible = false;
        if (muzzleFlashMeshRef.current) muzzleFlashMeshRef.current.visible = false;
      }

      // ✅ Bullet update with realistic distance cap
      for (let i = bulletsRef.current.length - 1; i >= 0; i -= 1) {
        const bullet = bulletsRef.current[i];
        bullet.position.addScaledVector(bullet.userData.velocity, delta);
        bullet.userData.travelled =
          (bullet.userData.travelled || 0) + bullet.userData.velocity.length() * delta;

        const maxDistance = bullet.userData.maxDistance ?? weapon.maxDistance;
        if (bullet.userData.travelled > maxDistance) {
          scene.remove(bullet);
          bullet.geometry.dispose();
          (bullet.material as THREE.Material).dispose();
          bulletsRef.current.splice(i, 1);
        }
      }
    });

    const shoot = () => {
      shootSound.currentTime = 0;
      shootSound.play();

      const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(weapon.radius, 12, 12),
        new THREE.MeshStandardMaterial({
          color: weapon.color,
          metalness: 0.35,
          roughness: 0.3,
          emissive: weapon.color,
          emissiveIntensity: 0.25 + weapon.damage / 80,
        })
      );

      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);

      const bulletStartPosition = camera.position
        .clone()
        .add(cameraDirection.clone().multiplyScalar(0.6))
        .add(new THREE.Vector3(0, -0.05, 0));
      bullet.position.copy(bulletStartPosition);
      bullet.quaternion.copy(camera.quaternion);
      const velocity = cameraDirection.clone().normalize().multiplyScalar(weapon.speed);
      bullet.userData.velocity = velocity;
      bullet.userData.travelled = 0;
      bullet.userData.maxDistance = weapon.maxDistance;
      bullet.userData.damage = weapon.damage;

      scene.add(bullet);
      bulletsRef.current.push(bullet);

      muzzleFlashTimerRef.current = MUZZLE_FLASH_DURATION;
      flashStrengthRef.current = weapon.flashIntensity;
      const recoilKick = RECOIL_BASE * (weapon.damage / 18);
      recoilRef.current = Math.min(recoilRef.current + recoilKick, 0.12);
      cameraShakeRef.current = 0.004 + weapon.damage * 0.0001;

      if (muzzleFlashLightRef.current) {
        muzzleFlashLightRef.current.visible = true;
        muzzleFlashLightRef.current.intensity = weapon.flashIntensity;
      }
      if (muzzleFlashMeshRef.current) {
        muzzleFlashMeshRef.current.visible = true;
        const mat = muzzleFlashMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.45;
        muzzleFlashMeshRef.current.scale.setScalar(1);
      }
    };

    return (
      <mesh ref={playerBodyRef} castShadow visible={false}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }
);
