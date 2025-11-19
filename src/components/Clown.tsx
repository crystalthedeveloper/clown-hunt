// components/Clown.tsx
import { useFrame } from "@react-three/fiber";
import { useAnimations } from "@react-three/drei";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useBox } from "@react-three/cannon";
import * as THREE from "three";
import { PlayerRef } from "./Player";

const CLOWN_SCALE = 0.65;

const cloneSkinnedModel = (source: THREE.Group) => {
  const clone = source.clone(true);
  const bonesMap: Record<string, THREE.Bone> = {};
  const skinnedMeshes: THREE.SkinnedMesh[] = [];

  clone.traverse((child) => {
    if ((child as THREE.Bone).isBone) bonesMap[child.name] = child as THREE.Bone;
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(child as THREE.SkinnedMesh);
  });

  skinnedMeshes.forEach((mesh) => {
    mesh.frustumCulled = false;
    if (mesh.skeleton) {
      mesh.skeleton = new THREE.Skeleton(mesh.skeleton.bones.map((bone) => bonesMap[bone.name] || bone));
    }
  });

  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  clone.position.sub(center);
  clone.position.y += (size.y * CLOWN_SCALE) / 2;
  clone.scale.setScalar(CLOWN_SCALE);

  return { clone, height: size.y * CLOWN_SCALE };
};

interface ClownProps {
  position: [number, number, number];
  model: THREE.Group;
  animations: THREE.AnimationClip[];
  playerRef: React.RefObject<PlayerRef>;
  speedMultiplier: number;
  state?: "alive" | "dying";
  deathAnimation?: string;
  onDeathComplete?: () => void;
  forcedAnimation?: string | null;
  deathLookTarget?: [number, number, number] | null;
}

export function Clown({
  position,
  model,
  animations,
  playerRef,
  speedMultiplier,
  state = "alive",
  deathAnimation,
  onDeathComplete,
  forcedAnimation,
  deathLookTarget,
}: ClownProps) {
  const clownRef = useRef<THREE.Group>(null);

  const [isAIActive, setIsAIActive] = useState(false);
  const [hasPlayedDeath, setHasPlayedDeath] = useState(false);
  const { clone: clonedScene, height } = useMemo(() => cloneSkinnedModel(model), [model]);

  const { actions } = useAnimations(animations, clonedScene);

  const colliderHeight = height * 0.9;
  const colliderRadius = 0.55;
  const [, api] = useBox(() => ({
    mass: 1,
    position: [position[0], position[1] + colliderHeight / 2, position[2]],
    args: [colliderRadius, colliderHeight, colliderRadius],
    fixedRotation: true,
    linearDamping: 0.6,
    angularDamping: 0.6,
    collisionFilterGroup: 1,
    collisionFilterMask: 1,
  }));

  const playAnimation = useCallback(
    (name: string, options?: { speed?: number; loopOnce?: boolean }) => {
      const { speed = 1, loopOnce = false } = options ?? {};
      Object.values(actions).forEach((action) => action?.fadeOut(0.2));
      const selected = actions[name];
      if (selected) {
        selected
          .reset()
          .fadeIn(0.2)
          .setEffectiveTimeScale(speed);
        if (loopOnce) {
          selected.setLoop(THREE.LoopOnce, 1);
          selected.clampWhenFinished = true;
        } else {
          selected.setLoop(THREE.LoopRepeat, Infinity);
          selected.clampWhenFinished = false;
        }
        selected.play();
      }
    },
    [actions],
  );
  
  const targetIdleSpeed = Math.max(0.45, Math.min(1, 0.5 + speedMultiplier * 0.25));

  useEffect(() => {
    if (state === "alive") {
      setHasPlayedDeath(false);
      const aiDelay = 250;
      const hasForcedAnimation = Boolean(forcedAnimation);
      const aiTimer = hasForcedAnimation
        ? null
        : window.setTimeout(() => setIsAIActive(true), aiDelay);
      if (forcedAnimation) {
        playAnimation(forcedAnimation, {
          speed: 1,
          loopOnce: forcedAnimation.toLowerCase().includes("player_die"),
        });
        setIsAIActive(false);
      } else {
        playAnimation("idle", { speed: targetIdleSpeed });
      }
      return () => {
        if (aiTimer !== null) {
          clearTimeout(aiTimer);
        }
      };
    }
    setIsAIActive(false);
    return undefined;
  }, [playAnimation, targetIdleSpeed, state, forcedAnimation]);

  useEffect(() => {
    return api.position.subscribe(([x, y, z]) => {
      clownRef.current?.position.set(x, Math.max(0.4, y - colliderHeight / 2), z);
    });
  }, [api, colliderHeight]);

  useEffect(() => {
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
    };
  }, [actions]);

  useEffect(() => {
    if (state !== "dying" || hasPlayedDeath) return;
    const allActions = Object.keys(actions);
    const target = (deathAnimation || "die_one").toLowerCase();
    const resolvedName =
      allActions.find((key) => key.toLowerCase().includes(target)) ??
      allActions.find((key) => key.toLowerCase().includes("die")) ??
      null;
    if (!resolvedName) {
      onDeathComplete?.();
      return;
    }
    const selected = actions[resolvedName];
    if (!selected) {
      onDeathComplete?.();
      return;
    }
    selected.reset().fadeIn(0.05).setLoop(THREE.LoopOnce, 1);
    selected.clampWhenFinished = true;
    selected.play();
    setHasPlayedDeath(true);

    const duration = selected.getClip().duration * 1000 + 200;
    const timeout = window.setTimeout(() => {
      onDeathComplete?.();
    }, duration);
    return () => {
      window.clearTimeout(timeout);
      selected.stop();
    };
  }, [actions, deathAnimation, hasPlayedDeath, onDeathComplete, state]);

  const isPlayerKillAnimation = forcedAnimation?.toLowerCase() === "player_die";

  useFrame(() => {
    if (state === "dying") return;

    if (isPlayerKillAnimation) {
      if (!playerRef.current || !clownRef.current) return;
      const playerPosition = playerRef.current.getPosition();
      const forward = playerRef.current.getForward?.()?.clone() ?? new THREE.Vector3(0, 0, -1);
      forward.y = 0;
      if (forward.lengthSq() === 0) {
        forward.set(0, 0, -1);
      }
      forward.normalize().multiplyScalar(2.2);
      const targetPosition = playerPosition.clone().add(forward);
      const targetY = Math.max(0.6, playerPosition.y);

      api.position.set(targetPosition.x, targetY, targetPosition.z);
      api.velocity.set(0, 0, 0);
      clownRef.current.position.set(targetPosition.x, targetY, targetPosition.z);

      const lookTarget = playerPosition.clone();
      lookTarget.y = targetY;
      clownRef.current.rotation.set(0, 0, 0);
      clownRef.current.lookAt(lookTarget);
      return;
    }

    if (!clownRef.current || !playerRef.current || !isAIActive) return;

    const clown = clownRef.current;
    const playerPos = playerRef.current.getPosition();

    clown.rotation.x = 0;
    clown.rotation.z = 0;
    clown.lookAt(playerPos);

    api.velocity.set(0, 0, 0);
  });

  useEffect(() => {
    if (!deathLookTarget || state !== "dying" || !clownRef.current) return;
    const target = new THREE.Vector3(...deathLookTarget);
    const basePosition = clownRef.current.getWorldPosition(new THREE.Vector3());
    target.y = basePosition.y;
    clownRef.current.lookAt(target);
  }, [deathLookTarget, state]);

  return (
    <group ref={clownRef}>
      <group rotation={[-Math.PI / 14, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

interface DyingClownProps {
  id: string;
  position: [number, number, number];
  model: THREE.Group;
  animations: THREE.AnimationClip[];
  animationName?: string;
  onComplete: (id: string) => void;
  lookAtTarget?: [number, number, number];
}

function getScaledClone(model: THREE.Group) {
  const { clone, height } = cloneSkinnedModel(model);
  return { clone, height };
}

export function DyingClown({
  id,
  position,
  model,
  animations,
  animationName,
  onComplete,
  lookAtTarget,
}: DyingClownProps) {
  const { clone: clonedScene, height } = useMemo(() => getScaledClone(model), [model]);
  const { actions } = useAnimations(animations, clonedScene);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const allActions = Object.keys(actions);
    const target = (animationName || "die_one").toLowerCase();
    const resolvedName =
      allActions.find((key) => key.toLowerCase().includes(target)) ??
      allActions.find((key) => key.toLowerCase().includes("die")) ??
      null;
    if (!resolvedName) {
      onComplete(id);
      return;
    }
    const action = actions[resolvedName];
    if (!action) {
      onComplete(id);
      return;
    }
    action.reset().fadeIn(0.05).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();

    const duration = action.getClip().duration * 1000 + 200;
    const timeout = window.setTimeout(() => {
      onComplete(id);
    }, duration);
    return () => {
      window.clearTimeout(timeout);
      action.stop();
    };
  }, [actions, animationName, id, onComplete]);

  useEffect(() => {
    if (!lookAtTarget || !groupRef.current) return;
    const target = new THREE.Vector3(...lookAtTarget);
    const currentPosition = new THREE.Vector3();
    groupRef.current.getWorldPosition(currentPosition);
    target.y = currentPosition.y;
    groupRef.current.lookAt(target);
  }, [lookAtTarget]);

  const yOffset = height * 0.45;

  return (
    <group ref={groupRef} position={[position[0], position[1] + yOffset, position[2]]}>
      <group rotation={[-Math.PI / 14, 0, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
