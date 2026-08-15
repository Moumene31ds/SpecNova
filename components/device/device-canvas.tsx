"use client";

import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html } from "@react-three/drei";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Procedural smartphone body (fallback) or remote GLB when `modelUrl` is
 * set. Wrapped in Suspense because useGLTF suspends.
 */
function GltfModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  return (
    <primitive
      object={scene}
      scale={1.6}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    />
  );
}

function PhoneModel({ modelUrl, brandColor }: { modelUrl?: string | null; brandColor: string }) {
  const color = new THREE.Color(brandColor);

  if (modelUrl) return <GltfModel modelUrl={modelUrl} />;

  return (
    <group>
      <RoundedBox args={[1.6, 3.2, 0.22]} radius={0.1} smoothness={4}>
        <meshStandardMaterial
          color={color}
          metalness={0.85}
          roughness={0.35}
          envMapIntensity={1.2}
        />
      </RoundedBox>
      {/* Display glass */}
      <RoundedBox args={[1.42, 2.9, 0.04]} radius={0.07} smoothness={4} position={[0, 0, 0.11]}>
        <meshStandardMaterial
          color="#0a0a12"
          metalness={0.4}
          roughness={0.15}
          emissive={new THREE.Color(brandColor)}
          emissiveIntensity={0.06}
        />
      </RoundedBox>
      {/* Camera island */}
      <group position={[0, 1.32, 0.13]}>
        {[0, 1, -1].map((x) => (
          <mesh key={x} position={[x * 0.28, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.02, 32]} />
            <meshStandardMaterial
              color={new THREE.Color("#111")}
              metalness={0.9}
              roughness={0.2}
              emissive={color}
              emissiveIntensity={0.12}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ScanLine() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime % 2.2) / 2.2;
    ref.current.position.y = -1.6 + t * 3.2;
    ref.current.position.z = 0.22;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1.5, 0.05]} />
      <meshBasicMaterial
        color="#00fff9"
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function DeviceCanvas({
  brandColor,
  modelUrl,
  deviceName,
}: {
  brandColor: string;
  modelUrl?: string | null;
  deviceName?: string;
}) {
  const [autoRotate, setAutoRotate] = useState(true);

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      onPointerDown={() => setAutoRotate(false)}
      className="h-full w-full"
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-4, -2, -5]} intensity={0.6} color={brandColor} />
      <pointLight position={[0, 3, 4]} intensity={12} color={brandColor} />

      <Suspense fallback={null}>
        <PhoneModel modelUrl={modelUrl} brandColor={brandColor} />
        <ScanLine />
        {deviceName && (
          <Html position={[0, -2.1, 0]} center className="pointer-events-none select-none">
            <div className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {deviceName}
            </div>
          </Html>
        )}
      </Suspense>

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 1.6}
      />
    </Canvas>
  );
}
