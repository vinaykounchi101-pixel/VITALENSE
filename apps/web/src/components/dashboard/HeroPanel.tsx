"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Heart,
  Moon,
  Flame,
  ShieldCheck,
  Sparkles,
  Info,
  PlusCircle,
  ExternalLink,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DashboardSummary } from "../../lib/api";
import { AnatomicalCanvas } from "../anatomical/AnatomicalCanvas";
import { AnatomicalZone } from "../anatomical/AnatomicalModel";
import gsap from "gsap";

export interface HeroPanelProps {
  summary: DashboardSummary | null;
  onLogVital?: () => void;
  onViewBodyExplorer?: () => void;
}

export function HeroPanel({
  summary,
  onLogVital,
  onViewBodyExplorer,
}: HeroPanelProps) {
  const [selectedZone, setSelectedZone] = useState<AnatomicalZone | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const greetingRef = useRef<HTMLHeadingElement>(null);
  const metricsStripRef = useRef<HTMLDivElement>(null);

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  const metrics = summary?.metrics || {};
  const hr = metrics["heart_rate"]?.latest_value;
  const sleepSec = metrics["sleep_session"]?.latest_value;
  const steps = metrics["steps"]?.latest_value;
  const energy = metrics["active_energy"]?.latest_value;

  const sleepHours = sleepSec ? (sleepSec / 3600).toFixed(1) : null;
  const dataQuality = summary?.data_quality_score ?? 0;
  const daysTracked = summary?.days_tracked ?? 0;

  // GSAP Entrance Sequence
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !heroRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      if (greetingRef.current) {
        tl.from(greetingRef.current, {
          y: 16,
          opacity: 0,
          duration: 0.6,
        });
      }

      if (metricsStripRef.current) {
        tl.from(
          metricsStripRef.current.children,
          {
            y: 12,
            opacity: 0,
            duration: 0.45,
            stagger: 0.08,
          },
          "-=0.3"
        );
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const getZoneLabel = (zone: AnatomicalZone | null) => {
    switch (zone) {
      case "cardiac":
        return "Cardiovascular Hub";
      case "respiratory":
        return "Pulmonary Hub";
      case "metabolic":
        return "Endocrine & Metabolic Hub";
      case "musculoskeletal":
        return "Musculoskeletal & Locomotion";
      case "sleep":
        return "Cranial & Circadian Hub";
      default:
        return null;
    }
  };

  return (
    <div
      ref={heroRef}
      className="relative overflow-hidden rounded-3xl border border-border bg-surface-elevated p-6 sm:p-8 shadow-xs"
    >
      {/* Background subtle radial glow */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-pill bg-brand-soft/20 dark:bg-brand/10 blur-3xl pointer-events-none" />

      <div className="relative z-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Greeting, Summary & Intelligence Status */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="mint" size="sm" className="gap-1 font-medium">
              <Sparkles className="h-3 w-3 text-brand" />
              <span>Biometric Intelligence</span>
            </Badge>
            {daysTracked > 0 ? (
              <Badge variant="neutral" size="sm">
                {daysTracked} days tracked
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Baseline onboarding
              </Badge>
            )}

            {selectedZone && (
              <Badge variant="brand" size="sm" className="animate-fade-in">
                {getZoneLabel(selectedZone)}
              </Badge>
            )}
          </div>

          <div>
            <h2
              ref={greetingRef}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-text-primary font-display"
            >
              {timeGreeting}
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1.5 max-w-lg leading-relaxed">
              Your personal health snapshot integrates verified platform telemetry, local encryption, and algorithmic baseline modeling.
            </p>
          </div>

          {/* Quick Metrics Strip */}
          <div
            ref={metricsStripRef}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"
          >
            <div
              onClick={() => setSelectedZone("cardiac")}
              className={`p-3 rounded-2xl bg-surface-subtle border cursor-pointer transition-all hover:border-coral/60 ${
                selectedZone === "cardiac"
                  ? "border-coral ring-1 ring-coral/40"
                  : "border-border/60"
              }`}
            >
              <span className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <Heart className="h-3 w-3 text-coral" /> Heart Rate
              </span>
              <p className="text-lg font-bold text-text-primary mt-1 tabular-nums font-display">
                {hr ? `${Math.round(hr)}` : "—"}
                <span className="text-xs font-normal text-text-muted ml-1">bpm</span>
              </p>
            </div>

            <div
              onClick={() => setSelectedZone("sleep")}
              className={`p-3 rounded-2xl bg-surface-subtle border cursor-pointer transition-all hover:border-lavender/60 ${
                selectedZone === "sleep"
                  ? "border-lavender ring-1 ring-lavender/40"
                  : "border-border/60"
              }`}
            >
              <span className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <Moon className="h-3 w-3 text-lavender" /> Sleep
              </span>
              <p className="text-lg font-bold text-text-primary mt-1 tabular-nums font-display">
                {sleepHours ? `${sleepHours}` : "—"}
                <span className="text-xs font-normal text-text-muted ml-1">hrs</span>
              </p>
            </div>

            <div
              onClick={() => setSelectedZone("musculoskeletal")}
              className={`p-3 rounded-2xl bg-surface-subtle border cursor-pointer transition-all hover:border-mint/60 ${
                selectedZone === "musculoskeletal"
                  ? "border-mint ring-1 ring-mint/40"
                  : "border-border/60"
              }`}
            >
              <span className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <Activity className="h-3 w-3 text-mint" /> Steps
              </span>
              <p className="text-lg font-bold text-text-primary mt-1 tabular-nums font-display">
                {steps ? `${Math.round(steps).toLocaleString()}` : "—"}
              </p>
            </div>

            <div
              onClick={() => setSelectedZone("metabolic")}
              className={`p-3 rounded-2xl bg-surface-subtle border cursor-pointer transition-all hover:border-peach/60 ${
                selectedZone === "metabolic"
                  ? "border-peach ring-1 ring-peach/40"
                  : "border-border/60"
              }`}
            >
              <span className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                <Flame className="h-3 w-3 text-peach" /> Active Burn
              </span>
              <p className="text-lg font-bold text-text-primary mt-1 tabular-nums font-display">
                {energy ? `${Math.round(energy)}` : "—"}
                <span className="text-xs font-normal text-text-muted ml-1">kcal</span>
              </p>
            </div>
          </div>

          {/* Actions & Non-medical notice */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onLogVital && (
              <Button
                variant="primary"
                size="md"
                onClick={onLogVital}
                leftIcon={<PlusCircle className="h-4 w-4" />}
              >
                Log Health Observation
              </Button>
            )}

            {onViewBodyExplorer && (
              <Button
                variant="secondary"
                size="md"
                onClick={onViewBodyExplorer}
                rightIcon={<ExternalLink className="h-3.5 w-3.5 text-text-muted" />}
              >
                Open Body Explorer
              </Button>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Info className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <span>Informational only — not a clinical diagnosis.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Anatomical 3D / 2D Visualizer Widget */}
        <div className="lg:col-span-5 flex justify-center items-center">
          <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-[380px] rounded-3xl bg-surface-subtle/80 border border-border p-4 flex flex-col items-center justify-between shadow-xs">
            {/* Header in widget */}
            <div className="w-full flex items-center justify-between z-10">
              <span className="text-xs font-semibold text-text-primary font-display flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                {summary?.recovery_score !== null && summary?.recovery_score !== undefined
                  ? "Recovery Score"
                  : "System Status"}
              </span>
              <span className="text-[11px] text-text-muted tabular-nums">
                {summary?.recovery_score !== null && summary?.recovery_score !== undefined
                  ? `${Math.round(summary.recovery_score)} / 100`
                  : `Quality: ${Math.round(
                      dataQuality <= 1.0 && dataQuality > 0
                        ? dataQuality * 100
                        : dataQuality
                    )}%`}
              </span>
            </div>

            {/* Anatomical Canvas (Interactive 3D / Fallback 2D) */}
            <div className="w-full h-[280px] relative my-auto">
              <AnatomicalCanvas
                activeZone={selectedZone}
                onSelectZone={(zone) => setSelectedZone(zone)}
                hr={hr}
                sleepHours={sleepHours}
                steps={steps}
              />
            </div>

            {/* Bottom Card Summary */}
            <div className="w-full pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-secondary z-10">
              <span>Telemetry sync:</span>
              <span className="font-medium text-text-primary">
                {summary?.generated_at
                  ? new Date(summary.generated_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Live"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
