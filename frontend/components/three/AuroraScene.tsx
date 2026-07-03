"use client";

/* AuroraScene — the only WebGL moment in the app.
   Three soft, glassy orbs floating in space. The cursor nudges them.
   Renders nothing on mobile (dpr=0) or when prefers-reduced-motion is set.
   Falls back to a static gradient if WebGL isn't available. */

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

type OrbProps = {
  position: [number, number, number];
  color: string;
  size: number;
  speed: number;
  phase: number;
};

function Orb({ position, color, size, speed, phase }: OrbProps) {
  const ref = useRef<THREE.Mesh>(null!);
  const start = useRef(performance.now() / 1000);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const p = ref.current;
    if (!p) return;
    /* Float on a Lissajous-ish path */
    p.position.x = position[0] + Math.sin(t * speed + phase) * 0.4;
    p.position.y = position[1] + Math.cos(t * speed * 0.8 + phase) * 0.5;
    p.position.z = position[2] + Math.sin(t * speed * 0.5 + phase) * 0.3;
    p.rotation.x = t * 0.05 + phase;
    p.rotation.y = t * 0.07 + phase;
  });

  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[size, 32]} />
      <MeshTransmissionMaterial
        color={color}
        thickness={size * 1.2}
        roughness={0.15}
        transmission={0.95}
        ior={1.4}
        chromaticAberration={0.06}
        backside
        samples={6}
        resolution={256}
      />
    </mesh>
  );
}

function CursorFollower() {
  const { camera, pointer } = useThree();
  useFrame(() => {
    /* Subtle parallax — camera drifts 0.15 toward the pointer */
    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#a682ff" />
      <pointLight position={[-5, -3, -3]} intensity={0.8} color="#5cf0ff" />
      <pointLight position={[0, -4, 4]} intensity={0.6} color="#ff5cb4" />
    </>
  );
}

export function AuroraScene() {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    /* Bail out on reduced motion or no WebGL */
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tiny = window.matchMedia("(max-width: 640px)").matches;
    if (reduced || tiny) {
      setOk(false);
      return;
    }
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) setOk(false);
    } catch {
      setOk(false);
    }
  }, []);

  const orbs = useMemo(
    () => [
      { position: [-2.2, 0.6, 0] as [number, number, number], color: "#7c5cff", size: 1.1, speed: 0.25, phase: 0 },
      { position: [2.4, -0.4, -0.5] as [number, number, number], color: "#5cf0ff", size: 0.9, speed: 0.3, phase: 1.2 },
      { position: [0.2, -1.4, 0.8] as [number, number, number], color: "#ff5cb4", size: 0.7, speed: 0.4, phase: 2.4 },
    ],
    []
  );

  if (!ok) return null;

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Lights />
      <CursorFollower />
      {orbs.map((o, i) => (
        <Orb key={i} {...o} />
      ))}
    </Canvas>
  );
}

export default AuroraScene;
