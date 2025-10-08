// components/Clown.tsx
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, Text } from "@react-three/drei";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useBox } from "@react-three/cannon";
import * as THREE from "three";
import { PlayerRef } from "./Player";

const bloodTexture = new THREE.TextureLoader().load("/blood-splatter.png");

interface ClownProps {
  id: number;
  position: [number, number, number];
  model: THREE.Group;
  animations: THREE.AnimationClip[];
  playerRef: React.RefObject<PlayerRef>;
  bulletsRef: React.MutableRefObject<THREE.Mesh[]>;
  onKill: (id: number) => void;
  onCatch: () => void;
  speedMultiplier: number;
  detectionRadius: number;
  aggression: number;
  initialHealth: number;
}

export function Clown({
  id,
  position,
  model,
  animations,
  playerRef,
  bulletsRef,
  onKill,
  onCatch,
  speedMultiplier,
  detectionRadius,
  aggression,
  initialHealth,
}: ClownProps) {
  const clownRef = useRef<THREE.Group>(null);
  const isDyingRef = useRef(false);
  const { camera, scene } = useThree();

  const [isAlive, setIsAlive] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [canCatch, setCanCatch] = useState(false);
  const [isAIActive, setIsAIActive] = useState(false);
  const [isGameOverTriggered, setIsGameOverTriggered] = useState(false);
  const lateralPhaseRef = useRef(Math.random() * Math.PI * 2);
  const [health, setHealth] = useState(initialHealth);
  const healthRef = useRef(initialHealth);
  type TextMesh = THREE.Mesh & { text: string };
  const healthTextRef = useRef<TextMesh | null>(null);

  const { clonedScene, height } = useMemo(() => {
    const clone = model.clone(true);

    const bonesMap: Record<string, THREE.Bone> = {};
    const skinnedMeshes: THREE.SkinnedMesh[] = [];

    clone.traverse((child) => {
      if ((child as THREE.Bone).isBone) bonesMap[child.name] = child as THREE.Bone;
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(child as THREE.SkinnedMesh);
    });

    skinnedMeshes.forEach((mesh) => {
      mesh.frustumCulled = false;
      if (mesh.skeleton) {
        mesh.skeleton = new THREE.Skeleton(
          mesh.skeleton.bones.map((bone) => bonesMap[bone.name] || bone)
        );
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center); // center pivot

    return { clonedScene: clone, height: size.y };
  }, [model]);

  const { actions } = useAnimations(animations, clonedScene);

  const [apiRef, api] = useBox(() => ({
    mass: 1,
    position: [position[0], position[1] + height / 2 + 1.0, position[2]],
    args: [1, height, 1],
    fixedRotation: true,
    linearDamping: 0.6,
    angularDamping: 0.6,
    collisionFilterGroup: 1,
    collisionFilterMask: 1,
  }));

  const playAnimation = useCallback((name: string, speed = 1) => {
    Object.values(actions).forEach((action) => action?.fadeOut(0.2));
    const selected = actions[name];
    if (selected) {
      selected.reset().fadeIn(0.2).setEffectiveTimeScale(speed).play();
    }
  }, [actions]);
  
  const targetIdleSpeed = Math.max(0.45, Math.min(1, 0.5 + speedMultiplier * 0.25));

  useEffect(() => {
    const catchDelay = Math.max(350, 1000 / Math.max(1, aggression));
    const aiDelay = Math.max(180, 500 / Math.max(1, aggression));
    const catchTimer = setTimeout(() => setCanCatch(true), catchDelay);
    const aiTimer = setTimeout(() => setIsAIActive(true), aiDelay);

    playAnimation("idle", targetIdleSpeed);

    return () => {
      clearTimeout(catchTimer);
      clearTimeout(aiTimer);
    };
  }, [aggression, playAnimation, targetIdleSpeed]);

  useEffect(() => {
    healthRef.current = initialHealth;
    setHealth(initialHealth);
    if (healthTextRef.current) {
      healthTextRef.current.text = `${initialHealth}`;
    }
  }, [initialHealth]);

  useEffect(() => {
    return api.position.subscribe(([x, y, z]) => {
      clownRef.current?.position.set(x, Math.max(0.5, y), z);
    });
  }, [api]);

  useEffect(() => {
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
    };
  }, [actions]);

  useFrame(() => {
    if (
      !isAlive ||
      isDyingRef.current ||
      !clownRef.current ||
      !playerRef.current ||
      isGameOverTriggered ||
      !isAIActive
    )
      return;

    const clown = clownRef.current;
    const clownPos = clown.position;
    const playerPos = playerRef.current.getPosition();
    const distance = clownPos.distanceTo(playerPos);

    const awarenessRadius = detectionRadius * 1.8;
    clown.rotation.x = 0;
    clown.rotation.z = 0;
    clown.lookAt(playerPos);

    if (distance > awarenessRadius) {
      if (isRunning) {
        setIsRunning(false);
        playAnimation("idle", targetIdleSpeed);
      }
      api.velocity.set(0, 0, 0);
      return;
    }

    if (healthTextRef.current) {
      healthTextRef.current.quaternion.copy(camera.quaternion);
    }

    if (distance <= detectionRadius) {
      const dir = new THREE.Vector3().subVectors(playerPos, clownPos).normalize();
      const lateral = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const time = performance.now() / 220;
      const wobble = Math.sin(time + lateralPhaseRef.current) * 0.6 * Math.max(0, aggression - 1);
      const jitter = Math.cos(time * 0.7 + id) * 0.35 * Math.max(0, aggression - 1);
      const finalDir = dir.clone().add(lateral.multiplyScalar(wobble)).add(dir.clone().multiplyScalar(jitter * 0.05));
      finalDir.normalize();

      const chaseSpeed = 5.8 * speedMultiplier * aggression;
      api.velocity.set(finalDir.x * chaseSpeed, 0, finalDir.z * chaseSpeed);

      const speedScale = Math.max(0.4, Math.min(1.35, chaseSpeed / 8.5));
      if (!isRunning) {
        setIsRunning(true);
        playAnimation("run", speedScale);
      } else {
        const currentRun = actions["run"];
        if (currentRun) {
          currentRun.setEffectiveTimeScale(speedScale);
        }
      }
    } else {
      if (isRunning) {
        setIsRunning(false);
        playAnimation("idle", targetIdleSpeed);
      }
      api.velocity.set(0, 0, 0);
    }

    if (distance < 1.5 && canCatch && !isGameOverTriggered) {
      setIsGameOverTriggered(true);
      api.velocity.set(0, 0, 0);
      playAnimation("idle");
      onCatch();
    }

    const clownBox = new THREE.Box3().setFromObject(clown);
    for (let index = bulletsRef.current.length - 1; index >= 0; index -= 1) {
      const bullet = bulletsRef.current[index];
      const bulletPos = new THREE.Vector3().setFromMatrixPosition(bullet.matrixWorld);
      if (!clownBox.containsPoint(bulletPos)) continue;

      const damage = Number(bullet.userData.damage) || 10;
      const nextHealth = Math.max(0, healthRef.current - damage);
      healthRef.current = nextHealth;
      setHealth(nextHealth);

      const blood = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: bloodTexture,
          transparent: true,
          depthWrite: false,
        })
      );

      blood.rotation.z = Math.random() * Math.PI;
      blood.scale.setScalar(1.2 + Math.random() * 0.6);
      blood.position.copy(bulletPos);
      blood.lookAt(camera.position);
      scene.add(blood);

      setTimeout(() => {
        blood.removeFromParent();
        blood.geometry.dispose();
        (blood.material as THREE.Material).dispose();
      }, 120);

      bullet.geometry.dispose();
      bullet.removeFromParent();
      bulletsRef.current.splice(index, 1);

      if (healthTextRef.current) {
        if (healthTextRef.current) {
          healthTextRef.current.text = `${Math.max(0, Math.round(nextHealth))}`;
        }
      }

      if (nextHealth <= 0 && !isDyingRef.current) {
        isDyingRef.current = true;
        setIsAlive(false);
        api.velocity.set(0, 0, 0);
        playAnimation("idle", targetIdleSpeed);

        setTimeout(() => {
          clown.removeFromParent();
          apiRef.current?.removeFromParent();
          onKill(id);
        }, 100);
      }
    }
  });

  return isAlive ? (
    <group ref={clownRef}>
      <Text
        ref={healthTextRef}
        position={[0, height + 0.95, 0]}
        fontSize={0.4}
        color="#ffeb3b"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="black"
      >
        {Math.round(health)}
      </Text>
      <group rotation={[-Math.PI / 14, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  ) : null;
}
