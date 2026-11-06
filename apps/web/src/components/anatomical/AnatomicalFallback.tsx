"use client";

import React from "react";
import { Heart, Moon, Activity, Flame, ShieldAlert } from "lucide-react";
import { AnatomicalZone } from "./AnatomicalModel";

interface AnatomicalFallbackProps {
  activeZone: AnatomicalZone | null;
  onSelectZone?: (zone: AnatomicalZone) => void;
  hr?: number | null;
  sleepHours?: string | null;
  steps?: number | null;
}

export function AnatomicalFallback({
  activeZone,
  onSelectZone,
  hr,
  sleepHours,
  steps,
}: AnatomicalFallbackProps) {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center select-none"
      role="region"
      aria-label="Interactive Anatomical Physiological Map"
    >
      <svg
        viewBox="0 0 160 260"
        className="w-40 h-64 text-border fill-current transition-colors"
      >
        {/* Cranial Head */}
        <circle
          cx="80"
          cy="30"
          r="18"
          className={
            activeZone === "sleep"
              ? "text-lavender fill-current"
              : "text-text-muted/30"
          }
        />
        {/* Neck */}
        <path d="M74 48 h12 v12 h-12 z" className="text-text-muted/30" />
        {/* Torso */}
        <path
          d="M50 60 C50 60, 60 58, 80 58 C100 58, 110 60, 110 60 C116 75, 112 125, 106 145 C100 148, 92 150, 80 150 C68 150, 60 148, 54 145 C48 125, 44 75, 50 60 Z"
          className={
            activeZone === "cardiac" || activeZone === "respiratory"
              ? "text-brand/30"
              : "text-text-muted/25"
          }
        />
        {/* Arms */}
        <path
          d="M48 64 C40 85, 34 120, 32 155 C32 158, 36 160, 38 158 C42 130, 48 95, 54 75 Z"
          className="text-text-muted/20"
        />
        <path
          d="M112 64 C120 85, 126 120, 128 155 C128 158, 124 160, 122 158 C118 130, 112 95, 106 75 Z"
          className="text-text-muted/20"
        />
        {/* Legs */}
        <path
          d="M58 150 C58 180, 56 220, 54 250 C54 254, 60 254, 64 250 C70 220, 74 180, 76 150 Z"
          className={
            activeZone === "musculoskeletal"
              ? "text-mint/40"
              : "text-text-muted/25"
          }
        />
        <path
          d="M102 150 C102 180, 104 220, 106 250 C106 254, 100 254, 96 250 C90 220, 86 180, 84 150 Z"
          className={
            activeZone === "musculoskeletal"
              ? "text-mint/40"
              : "text-text-muted/25"
          }
        />
      </svg>

      {/* Heart / Cardiac Node */}
      <button
        type="button"
        onClick={() => onSelectZone?.("cardiac")}
        className="absolute top-[32%] left-[42%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-coral rounded-pill"
        title={`Cardiac: ${hr ? Math.round(hr) + " bpm" : "Telemetry Active"}`}
        aria-label="Select Cardiac Zone"
      >
        <div className="h-6 w-6 rounded-pill bg-coral/25 animate-ping absolute" />
        <div
          className={`h-5 w-5 rounded-pill flex items-center justify-center shadow-xs transition-transform ${
            activeZone === "cardiac"
              ? "bg-coral text-white scale-125"
              : "bg-coral/80 text-white group-hover:scale-110"
          }`}
        >
          <Heart className="h-2.5 w-2.5 fill-current" />
        </div>
      </button>

      {/* Sleep / Mind Node */}
      <button
        type="button"
        onClick={() => onSelectZone?.("sleep")}
        className="absolute top-[12%] right-[22%] flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-lavender rounded-pill"
        title={`Cranial / Sleep: ${sleepHours ? sleepHours + " hrs" : "Telemetry Active"}`}
        aria-label="Select Cranial & Sleep Zone"
      >
        <div
          className={`h-5 w-5 rounded-pill flex items-center justify-center shadow-xs transition-transform ${
            activeZone === "sleep"
              ? "bg-lavender text-white scale-125"
              : "bg-lavender/80 text-white group-hover:scale-110"
          }`}
        >
          <Moon className="h-2.5 w-2.5 fill-current" />
        </div>
      </button>

      {/* Musculoskeletal / Movement Node */}
      <button
        type="button"
        onClick={() => onSelectZone?.("musculoskeletal")}
        className="absolute bottom-[20%] left-[20%] flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-mint rounded-pill"
        title={`Musculoskeletal: ${steps ? Math.round(steps).toLocaleString() + " steps" : "Telemetry Active"}`}
        aria-label="Select Musculoskeletal Zone"
      >
        <div
          className={`h-5 w-5 rounded-pill flex items-center justify-center shadow-xs transition-transform ${
            activeZone === "musculoskeletal"
              ? "bg-mint text-primary-text scale-125"
              : "bg-mint/80 text-primary-text group-hover:scale-110"
          }`}
        >
          <Activity className="h-2.5 w-2.5" />
        </div>
      </button>

      {/* Metabolic / Liver Node */}
      <button
        type="button"
        onClick={() => onSelectZone?.("metabolic")}
        className="absolute top-[44%] right-[32%] flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-peach rounded-pill"
        title="Metabolic / Endocrine Hub"
        aria-label="Select Metabolic Zone"
      >
        <div
          className={`h-5 w-5 rounded-pill flex items-center justify-center shadow-xs transition-transform ${
            activeZone === "metabolic"
              ? "bg-peach text-primary-text scale-125"
              : "bg-peach/80 text-primary-text group-hover:scale-110"
          }`}
        >
          <Flame className="h-2.5 w-2.5" />
        </div>
      </button>
    </div>
  );
}

