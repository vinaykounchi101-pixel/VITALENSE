"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AnatomicalZone } from "./AnatomicalModel";
import { AnatomicalFallback } from "./AnatomicalFallback";
import { Box, Layers, RotateCcw } from "lucide-react";

// Dynamically import 3D Three.js canvas to prevent SSR hydration errors
const DynamicAnatomicalScene = dynamic(
  () =>
    import("./AnatomicalScene").then((mod) => ({
      default: mod.AnatomicalScene,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs text-text-muted animate-pulse">
        Initializing 3D physiological model...
      </div>
    ),
  }
);

interface AnatomicalCanvasProps {
  activeZone: AnatomicalZone | null;
  onSelectZone?: (zone: AnatomicalZone) => void;
  hr?: number | null;
  sleepHours?: string | null;
  steps?: number | null;
}

export function AnatomicalCanvas({
  activeZone,
  onSelectZone,
  hr,
  sleepHours,
  steps,
}: AnatomicalCanvasProps) {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);
  const [renderMode, setRenderMode] = useState<"3d" | "2d">("3d");
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    // Detect theme from DOM
    const checkDark = () =>
      document.documentElement.classList.contains("dark");
    setIsDark(checkDark());

    const observer = new MutationObserver(() => {
      setIsDark(checkDark());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Detect WebGL capability
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      const available = Boolean(gl);

      // Also check reduced motion
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      setHasWebGL(available);
      if (!available || prefersReduced) {
        setRenderMode("2d");
      }
    } catch {
      setHasWebGL(false);
      setRenderMode("2d");
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Mode Switcher Toggle Pill */}
      {hasWebGL && (
        <div className="absolute top-2 right-2 z-10 flex items-center bg-surface-subtle/80 backdrop-blur-xs border border-border/80 rounded-pill p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setRenderMode("3d")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-pill transition-all ${
              renderMode === "3d"
                ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
            title="Interactive 3D anatomical model"
          >
            <Box className="h-3 w-3" />
            <span>3D</span>
          </button>
          <button
            type="button"
            onClick={() => setRenderMode("2d")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-pill transition-all ${
              renderMode === "2d"
                ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                : "text-text-muted hover:text-text-primary"
            }`}
            title="Schematic 2D vector graphic"
          >
            <Layers className="h-3 w-3" />
            <span>2D</span>
          </button>
        </div>
      )}

      {/* Render 3D Scene or Fallback */}
      <div className="w-full h-full min-h-[260px] flex items-center justify-center">
        {hasWebGL && renderMode === "3d" ? (
          <DynamicAnatomicalScene
            activeZone={activeZone}
            onSelectZone={onSelectZone}
            isDark={isDark}
          />
        ) : (
          <AnatomicalFallback
            activeZone={activeZone}
            onSelectZone={onSelectZone}
            hr={hr}
            sleepHours={sleepHours}
            steps={steps}
          />
        )}
      </div>

      {/* Hint / Instructions */}
      <div className="w-full pt-1 flex items-center justify-between text-[10px] text-text-muted select-none">
        {renderMode === "3d" ? (
          <span>Drag to orbit • Scroll to zoom • Click nodes</span>
        ) : (
          <span>Tap highlighted hubs to inspect telemetry</span>
        )}
      </div>
    </div>
  );
}

