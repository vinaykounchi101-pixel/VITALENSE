"use client";

import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { Heart, Moon, Activity, Flame, ShieldAlert, Wind } from "lucide-react";

export type AnatomicalZone =
  | "cardiac"
  | "respiratory"
  | "metabolic"
  | "musculoskeletal"
  | "sleep";

interface AnatomicalModelProps {
  activeZone: AnatomicalZone | null;
  onSelectZone?: (zone: AnatomicalZone) => void;
  isDark?: boolean;
}

// Map individual anatomical muscle names to target physiological systems
function getMuscleZone(name: string): AnatomicalZone {
  const n = name.toLowerCase();
  if (
    n.includes("pectoral") ||
    n.includes("heart") ||
    n.includes("aorta") ||
    n.includes("atrium") ||
    n.includes("ventricle")
  ) {
    return "cardiac";
  }
  if (
    n.includes("abdominis") ||
    n.includes("oblique") ||
    n.includes("pyramidalis")
  ) {
    return "metabolic";
  }
  if (
    n.includes("frontalis") ||
    n.includes("temporalis") ||
    n.includes("occipital") ||
    n.includes("epicranial") ||
    n.includes("platysma") ||
    n.includes("sternocleidomastoid") ||
    n.includes("masseter") ||
    n.includes("orbicularis")
  ) {
    return "sleep";
  }
  if (
    n.includes("intercostal") ||
    n.includes("serratus-posterior") ||
    n.includes("scalenus")
  ) {
    return "respiratory";
  }
  return "musculoskeletal";
}

export function AnatomicalModel({
  activeZone,
  onSelectZone,
  isDark = true,
}: AnatomicalModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const heartGroupRef = useRef<THREE.Group>(null);
  const lungsGroupRef = useRef<THREE.Group>(null);
  const [hoveredZone, setHoveredZone] = useState<AnatomicalZone | null>(null);

  // Load professionally authored whole-body skeletal muscles, anatomical heart, and lungs
  // Source: BodyParts3D (DBCLS) - CC BY-SA 2.1 Japan
  const { scene: muscleScene } = useGLTF("/models/muscles.glb");
  const { scene: heartScene } = useGLTF("/models/heart.glb");
  const { scene: lungsScene } = useGLTF("/models/lungs.glb");

  // Subtle natural idle sway & physiological heartbeat / respiratory rhythms
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Micro restrained breathing sway
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.9) * 0.015;
      groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.05;
    }

    // Anatomical cardiac dual pulse (systolic & diastolic rhythm)
    if (heartGroupRef.current) {
      const pulse =
        1 +
        Math.pow(Math.sin(t * 3.8), 12) * 0.12 +
        Math.pow(Math.sin(t * 3.8 + 0.45), 12) * 0.06;
      heartGroupRef.current.scale.set(0.082 * pulse, 0.082 * pulse, 0.082 * pulse);
    }

    // Subtle rhythmic pulmonary respiration (breathing expansion)
    if (lungsGroupRef.current) {
      const breath = Math.sin(t * 1.5);
      const lungPulseX = 1 + breath * 0.05;
      const lungPulseY = 1 + breath * 0.03;
      const lungPulseZ = 1 + breath * 0.06;
      lungsGroupRef.current.scale.set(
        0.086 * lungPulseX,
        0.086 * lungPulseY,
        0.086 * lungPulseZ
      );
    }
  });

  // Prepare cloned muscle hierarchy with translucent cool-blue medical shader
  const preparedMuscleScene = useMemo(() => {
    const clone = muscleScene.clone(true);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const muscleZone = getMuscleZone(mesh.name);
        const isZoneSelected = activeZone === muscleZone;
        const isZoneHovered = hoveredZone === muscleZone;
        const isDimmed = activeZone !== null && !isZoneSelected;

        // Color palettes matching VitalSense UI/UX Design Package v2
        let meshColor = isDark ? new THREE.Color("#4B7BB5") : new THREE.Color("#6B99C4");
        let meshEmissive = isDark ? new THREE.Color("#112440") : new THREE.Color("#D8E9F8");
        let emissiveIntensity = isDark ? 0.35 : 0.15;
        let opacity = isDark ? 0.70 : 0.76;

        if (isZoneSelected || isZoneHovered) {
          switch (muscleZone) {
            case "cardiac":
              meshColor = new THREE.Color("#E98F8E");
              meshEmissive = new THREE.Color("#9E3232");
              emissiveIntensity = 0.95;
              opacity = 0.88;
              break;
            case "respiratory":
              meshColor = new THREE.Color("#8EB9D8");
              meshEmissive = new THREE.Color("#204B6E");
              emissiveIntensity = 0.9;
              opacity = 0.88;
              break;
            case "metabolic":
              meshColor = new THREE.Color("#F0B58D");
              meshEmissive = new THREE.Color("#8A4A1C");
              emissiveIntensity = 0.9;
              opacity = 0.88;
              break;
            case "musculoskeletal":
              meshColor = new THREE.Color("#A9C9B9");
              meshEmissive = new THREE.Color("#255745");
              emissiveIntensity = 0.85;
              opacity = 0.88;
              break;
            case "sleep":
              meshColor = new THREE.Color("#B8A9E6");
              meshEmissive = new THREE.Color("#4E3A82");
              emissiveIntensity = 0.9;
              opacity = 0.88;
              break;
          }
        } else if (isDimmed) {
          opacity = isDark ? 0.32 : 0.40;
          emissiveIntensity = 0.1;
        }

        mesh.material = new THREE.MeshStandardMaterial({
          color: meshColor,
          emissive: meshEmissive,
          emissiveIntensity,
          roughness: 0.28,
          metalness: 0.22,
          transparent: true,
          opacity,
          depthWrite: true,
          side: THREE.DoubleSide,
        });

        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return clone;
  }, [muscleScene, activeZone, hoveredZone, isDark]);

  // Prepare cloned heart hierarchy
  const preparedHeartScene = useMemo(() => {
    const clone = heartScene.clone(true);
    const isCardiacActive = activeZone === "cardiac" || hoveredZone === "cardiac";

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#FF7675"),
          emissive: new THREE.Color("#D63031"),
          emissiveIntensity: isCardiacActive ? 1.6 : 0.85,
          roughness: 0.32,
          metalness: 0.15,
          transparent: false,
          depthWrite: true,
        });
      }
    });

    return clone;
  }, [heartScene, activeZone, hoveredZone]);

  // Prepare cloned lungs hierarchy with translucent pulmonary cyan shader
  const preparedLungsScene = useMemo(() => {
    const clone = lungsScene.clone(true);
    const isRespActive =
      activeZone === "respiratory" || hoveredZone === "respiratory";
    const isCardiacActive =
      activeZone === "cardiac" || hoveredZone === "cardiac";

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: isRespActive
            ? new THREE.Color("#70B6F6")
            : isDark
            ? new THREE.Color("#5A8BA8")
            : new THREE.Color("#7AAEC9"),
          emissive: isRespActive
            ? new THREE.Color("#204B6E")
            : new THREE.Color("#0A1C2C"),
          emissiveIntensity: isRespActive ? 1.2 : 0.25,
          roughness: 0.35,
          metalness: 0.18,
          transparent: true,
          opacity: isRespActive ? 0.80 : isCardiacActive ? 0.30 : 0.48,
          depthWrite: false, // Ensures inner heart illuminates through lungs
          side: THREE.DoubleSide,
        });
      }
    });

    return clone;
  }, [lungsScene, activeZone, hoveredZone, isDark]);

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (e.object && e.object.name) {
      const zone = getMuscleZone(e.object.name);
      setHoveredZone(zone);
      document.body.style.cursor = "pointer";
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredZone(null);
    document.body.style.cursor = "auto";
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (e.object && e.object.name) {
      const zone = getMuscleZone(e.object.name);
      onSelectZone?.(zone);
    }
  };

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      {/* 1. Real Anatomical Human Muscular Hierarchy (scaled to ~3.16 units height) */}
      <primitive
        object={preparedMuscleScene}
        scale={[0.48, 0.48, 0.48]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />

      {/* 2. Embedded Real Anatomical Heart (nested in chest cavity) */}
      <group
        ref={heartGroupRef}
        position={[0.015, 0.79, 0.08]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectZone?.("cardiac");
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredZone("cardiac");
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredZone(null);
          document.body.style.cursor = "auto";
        }}
      >
        <primitive object={preparedHeartScene} />
        {/* Interior Cardiac Glow radiating outward through translucent chest */}
        <pointLight
          color="#FF6B6B"
          intensity={activeZone === "cardiac" ? 3.0 : 1.4}
          distance={1.4}
        />
      </group>

      {/* 3. Embedded Real Anatomical Lungs (nested in thoracic cavity) */}
      <group
        ref={lungsGroupRef}
        position={[0.0, 0.84, 0.03]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectZone?.("respiratory");
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredZone("respiratory");
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredZone(null);
          document.body.style.cursor = "auto";
        }}
      >
        <primitive object={preparedLungsScene} />
      </group>

      {/* 4. Interactive Physiological Hub Pins matching UI Showcase */}
      {/* Cardiac Hub Pin */}
      <Html position={[0.42, 0.85, 0.22]} center distanceFactor={6.2}>
        <button
          type="button"
          onClick={() => onSelectZone?.("cardiac")}
          className={`group flex items-center justify-center rounded-pill transition-transform focus:outline-none ${
            activeZone === "cardiac" ? "scale-125" : "hover:scale-110"
          }`}
          title="Cardiovascular System"
          aria-label="Select Cardiovascular System"
        >
          <div className="h-6 w-6 rounded-pill bg-coral/30 animate-ping absolute" />
          <div className="h-5 w-5 rounded-pill bg-coral text-white flex items-center justify-center shadow-md border border-white/40">
            <Heart className="h-2.5 w-2.5 fill-current" />
          </div>
        </button>
      </Html>

      {/* Cranial / Sleep Hub Pin */}
      <Html position={[0.32, 1.46, 0.2]} center distanceFactor={6.2}>
        <button
          type="button"
          onClick={() => onSelectZone?.("sleep")}
          className={`group flex items-center justify-center rounded-pill transition-transform focus:outline-none ${
            activeZone === "sleep" ? "scale-125" : "hover:scale-110"
          }`}
          title="Cranial & Circadian Hub"
          aria-label="Select Cranial Hub"
        >
          <div className="h-5 w-5 rounded-pill bg-lavender text-white flex items-center justify-center shadow-md border border-white/40">
            <Moon className="h-2.5 w-2.5 fill-current" />
          </div>
        </button>
      </Html>

      {/* Metabolic Hub Pin */}
      <Html position={[-0.32, 0.40, 0.24]} center distanceFactor={6.2}>
        <button
          type="button"
          onClick={() => onSelectZone?.("metabolic")}
          className={`group flex items-center justify-center rounded-pill transition-transform focus:outline-none ${
            activeZone === "metabolic" ? "scale-125" : "hover:scale-110"
          }`}
          title="Metabolic & Endocrine Hub"
          aria-label="Select Metabolic Hub"
        >
          <div className="h-5 w-5 rounded-pill bg-peach text-primary-text flex items-center justify-center shadow-md border border-white/40">
            <Flame className="h-2.5 w-2.5" />
          </div>
        </button>
      </Html>

      {/* Musculoskeletal Hub Pin */}
      <Html position={[-0.52, -0.25, 0.2]} center distanceFactor={6.2}>
        <button
          type="button"
          onClick={() => onSelectZone?.("musculoskeletal")}
          className={`group flex items-center justify-center rounded-pill transition-transform focus:outline-none ${
            activeZone === "musculoskeletal" ? "scale-125" : "hover:scale-110"
          }`}
          title="Musculoskeletal & Locomotion"
          aria-label="Select Musculoskeletal System"
        >
          <div className="h-5 w-5 rounded-pill bg-mint text-primary-text flex items-center justify-center shadow-md border border-white/40">
            <Activity className="h-2.5 w-2.5" />
          </div>
        </button>
      </Html>

      {/* Pulmonary / Respiratory Hub Pin */}
      <Html position={[-0.38, 0.95, 0.18]} center distanceFactor={6.2}>
        <button
          type="button"
          onClick={() => onSelectZone?.("respiratory")}
          className={`group flex items-center justify-center rounded-pill transition-transform focus:outline-none ${
            activeZone === "respiratory" ? "scale-125" : "hover:scale-110"
          }`}
          title="Pulmonary & Respiratory System"
          aria-label="Select Respiratory System"
        >
          <div className="h-5 w-5 rounded-pill bg-blue text-white flex items-center justify-center shadow-md border border-white/40">
            <Wind className="h-2.5 w-2.5" />
          </div>
        </button>
      </Html>
    </group>
  );
}

// Preload assets for fast rendering
useGLTF.preload("/models/muscles.glb");
useGLTF.preload("/models/heart.glb");
useGLTF.preload("/models/lungs.glb");
