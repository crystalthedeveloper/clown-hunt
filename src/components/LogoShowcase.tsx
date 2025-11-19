import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface LogoShowcaseProps {
  position?: [number, number, number];
  scale?: number | [number, number, number];
}

export function LogoShowcase({ position = [0, 1.4, -8], scale = 2 }: LogoShowcaseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/logos.glb");

  const logo = useMemo(() => {
    const cloned = scene.clone(true);
    const updateMaterial = (material: THREE.Material) => {
      if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const mat = (material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color("#ffe600");
        mat.emissive = new THREE.Color("#ffe600");
        mat.emissiveIntensity = 0.10;
        mat.metalness = 0.85;
        mat.roughness = 0.28;
        return mat;
      }
      return material;
    };

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(updateMaterial);
        } else if (mesh.material) {
          mesh.material = updateMaterial(mesh.material);
        }
        const bbox = new THREE.Box3().setFromObject(mesh);
        const size = bbox.getSize(new THREE.Vector3());
        if (size.x > size.z) {
          mesh.scale.y *= 2;
        } else {
          mesh.scale.x *= 1.4;
        }
      }
    });
    return cloned;
  }, [scene]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  const finalScale: [number, number, number] = Array.isArray(scale)
    ? scale
    : [scale, scale, scale];

  return (
    <group ref={groupRef} position={position} scale={finalScale}>
      <primitive object={logo} />
    </group>
  );
}

useGLTF.preload("/logos.glb");
