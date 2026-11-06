"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { AnatomicalModel, AnatomicalZone } from "./AnatomicalModel";

interface AnatomicalSceneProps {
  activeZone: AnatomicalZone | null;
  onSelectZone?: (zone: AnatomicalZone) => void;
  isDark?: boolean;
}

export function AnatomicalScene({
  activeZone,
  onSelectZone,
  isDark = true,
}: AnatomicalSceneProps) {
  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      <Canvas
        camera={{ position: [0, 0.05, 4.3], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          {/* Ambient Lighting - balanced for contrast and depth */}
          <ambientLight intensity={isDark ? 0.70 : 0.95} />

          {/* Key Light (Upper-Right Frontal) - picks up muscle definition & striations */}
          <directionalLight
            position={[2.5, 4.0, 3.5]}
            intensity={isDark ? 1.6 : 1.3}
            color={isDark ? "#FFFFFF" : "#FFFBF0"}
          />

          {/* Vivid Rim / Back Light (Behind) - generates cool-blue silhouette edge glow matching showcase */}
          <directionalLight
            position={[0, 2.0, -4.0]}
            intensity={isDark ? 2.4 : 1.2}
            color="#70B6F6"
          />

          {/* Lateral Rim Accent */}
          <directionalLight
            position={[-3.5, 0.5, -2.5]}
            intensity={isDark ? 1.4 : 0.8}
            color="#A9C9B9"
          />

          {/* Soft Fill Light (Lower-Left Frontal) */}
          <directionalLight
            position={[-3.0, 1.5, 2.0]}
            intensity={isDark ? 0.8 : 0.5}
            color="#8EB9D8"
          />

          {/* The 3D Anatomical Character */}
          <AnatomicalModel
            activeZone={activeZone}
            onSelectZone={onSelectZone}
            isDark={isDark}
          />

          {/* Controlled, bounded orbital motion */}
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={2.8}
            maxDistance={5.5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.7}
            minAzimuthAngle={-Math.PI / 3}
            maxAzimuthAngle={Math.PI / 3}
            rotateSpeed={0.6}
            zoomSpeed={0.6}
            dampingFactor={0.08}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

