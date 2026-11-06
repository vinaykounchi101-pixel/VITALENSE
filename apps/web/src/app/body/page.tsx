"use client";

import React, { useState, useEffect } from "react";
import {
  Heart,
  Droplet,
  Activity,
  Moon,
  Flame,
  ShieldCheck,
  Plus,
  Info,
} from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingState } from "../../components/ui/LoadingState";
import { ManualEntryModal } from "../../components/ManualEntryModal";
import { api, DashboardSummary } from "../../lib/api";
import { AnatomicalCanvas } from "../../components/anatomical/AnatomicalCanvas";
import { AnatomicalZone } from "../../components/anatomical/AnatomicalModel";

type BodyZone = "cardiac" | "respiratory" | "metabolic" | "musculoskeletal" | "sleep";

export default function BodyExplorerPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<BodyZone>("cardiac");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.analytics.getDashboardSummary();
      setSummary(res);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = summary?.metrics || {};
  const hr = metrics["heart_rate"]?.latest_value;
  const rhr = metrics["resting_heart_rate"]?.latest_value;
  const sys = metrics["blood_pressure_systolic"]?.latest_value;
  const dia = metrics["blood_pressure_diastolic"]?.latest_value;
  const spo2 = metrics["blood_oxygen_saturation"]?.latest_value;
  const glucose = metrics["blood_glucose"]?.latest_value;
  const steps = metrics["steps"]?.latest_value;
  const energy = metrics["active_energy"]?.latest_value;
  const sleepSec = metrics["sleep_session"]?.latest_value;
  const sleepHours = sleepSec ? (sleepSec / 3600).toFixed(1) : null;

  return (
    <AppShell
      title="Body Explorer & Anatomical Telemetry"
      subtitle="Interactive physiological organ mapping and multi-system baseline inspection"
      onRefreshData={loadData}
    >
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-border">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveZone("cardiac")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-medium transition-all ${
                activeZone === "cardiac"
                  ? "bg-coral text-white font-semibold shadow-xs"
                  : "bg-surface-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              Cardiovascular
            </button>
            <button
              onClick={() => setActiveZone("respiratory")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-medium transition-all ${
                activeZone === "respiratory"
                  ? "bg-blue text-white font-semibold shadow-xs"
                  : "bg-surface-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              Respiratory
            </button>
            <button
              onClick={() => setActiveZone("metabolic")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-medium transition-all ${
                activeZone === "metabolic"
                  ? "bg-peach text-white font-semibold shadow-xs"
                  : "bg-surface-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              Metabolic
            </button>
            <button
              onClick={() => setActiveZone("musculoskeletal")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-medium transition-all ${
                activeZone === "musculoskeletal"
                  ? "bg-mint text-primary-text font-semibold shadow-xs"
                  : "bg-surface-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              Musculoskeletal
            </button>
            <button
              onClick={() => setActiveZone("sleep")}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-medium transition-all ${
                activeZone === "sleep"
                  ? "bg-lavender text-white font-semibold shadow-xs"
                  : "bg-surface-subtle text-text-secondary hover:text-text-primary"
              }`}
            >
              Circadian & Sleep
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4 text-brand" />}
          >
            Log Measurement
          </Button>
        </div>

        {/* Anatomical Inspection Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Anatomical Silhouette Visualizer */}
          <div className="lg:col-span-5 rounded-3xl border border-border bg-surface p-6 sm:p-8 flex flex-col items-center justify-between min-h-[460px]">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-primary font-display">
                Physiological Focus:{" "}
                <span className="capitalize text-brand">{activeZone}</span>
              </span>
              <Badge variant="mint" size="sm">
                Interactive Telemetry
              </Badge>
            </div>

            <div className="w-full h-[320px] relative my-auto">
              <AnatomicalCanvas
                activeZone={activeZone as AnatomicalZone}
                onSelectZone={(zone) => setActiveZone(zone as BodyZone)}
                hr={hr}
                sleepHours={sleepHours}
                steps={steps}
              />
            </div>

            <p className="text-[11px] text-text-muted mt-2 text-center">
              Select anatomical markers or drag to orbit in 3D to inspect localized telemetry and sensor fidelity.
            </p>
          </div>

          {/* Biometric Telemetry Detail Panel */}
          <div className="lg:col-span-7 space-y-4">
            {activeZone === "cardiac" && (
              <Card variant="default">
                <CardHeader>
                  <div>
                    <CardTitle className="text-coral flex items-center gap-2">
                      <Heart className="h-4 w-4 fill-current" />
                      <span>Cardiovascular System</span>
                    </CardTitle>
                    <CardDescription>
                      Continuous heart rate telemetry, nocturnal resting baselines, and oscillometric blood pressure
                    </CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-3 pt-2">
                  <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Current Heart Rate</span>
                      <p className="text-xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                        {hr ? `${Math.round(hr)} bpm` : "No reading"}
                      </p>
                    </div>
                    <Badge variant="coral" size="sm">
                      Sensor: PPG
                    </Badge>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Resting Heart Rate</span>
                      <p className="text-xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                        {rhr ? `${Math.round(rhr)} bpm` : "No reading"}
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      Baseline: 60-100 bpm
                    </Badge>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Paired Blood Pressure</span>
                      <p className="text-xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                        {sys && dia ? `${Math.round(sys)} / ${Math.round(dia)} mmHg` : "No paired reading"}
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      Normal: &lt; 120/80
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            {activeZone === "respiratory" && (
              <Card variant="default">
                <CardHeader>
                  <div>
                    <CardTitle className="text-blue flex items-center gap-2">
                      <Droplet className="h-4 w-4 fill-current" />
                      <span>Respiratory System</span>
                    </CardTitle>
                    <CardDescription>
                      Pulse oximetry saturation and respiratory gas exchange telemetry
                    </CardDescription>
                  </div>
                </CardHeader>
                <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between mt-2">
                  <div>
                    <span className="text-xs text-text-muted">Blood Oxygen (SpO2)</span>
                    <p className="text-2xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                      {spo2 ? `${spo2.toFixed(1)}%` : "No reading"}
                    </p>
                  </div>
                  <Badge variant="blue" size="sm">
                    Target: 95% – 100%
                  </Badge>
                </div>
              </Card>
            )}

            {activeZone === "metabolic" && (
              <Card variant="default">
                <CardHeader>
                  <div>
                    <CardTitle className="text-peach flex items-center gap-2">
                      <Flame className="h-4 w-4 fill-current" />
                      <span>Metabolic System</span>
                    </CardTitle>
                    <CardDescription>
                      Active energy expenditure and continuous / episodic blood glucose readings
                    </CardDescription>
                  </div>
                </CardHeader>
                <div className="space-y-3 pt-2">
                  <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Blood Glucose</span>
                      <p className="text-xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                        {glucose ? `${glucose.toFixed(1)} mg/dL` : "No reading"}
                      </p>
                    </div>
                    <Badge variant="peach" size="sm">
                      Fasting: 70-99 mg/dL
                    </Badge>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Active Caloric Burn</span>
                      <p className="text-xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                        {energy ? `${Math.round(energy)} kcal` : "No reading"}
                      </p>
                    </div>
                    <Badge variant="mint" size="sm">
                      Daily load
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            {activeZone === "musculoskeletal" && (
              <Card variant="default">
                <CardHeader>
                  <div>
                    <CardTitle className="text-mint flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span>Musculoskeletal Telemetry</span>
                    </CardTitle>
                    <CardDescription>
                      Step ambulation cadence and mechanical muscular strain
                    </CardDescription>
                  </div>
                </CardHeader>
                <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between mt-2">
                  <div>
                    <span className="text-xs text-text-muted">Daily Step Count</span>
                    <p className="text-2xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                      {steps ? `${Math.round(steps).toLocaleString()} steps` : "No reading"}
                    </p>
                  </div>
                  <Badge variant="mint" size="sm">
                    Baseline: 10,000 steps
                  </Badge>
                </div>
              </Card>
            )}

            {activeZone === "sleep" && (
              <Card variant="default">
                <CardHeader>
                  <div>
                    <CardTitle className="text-lavender flex items-center gap-2">
                      <Moon className="h-4 w-4 fill-current" />
                      <span>Circadian Recovery</span>
                    </CardTitle>
                    <CardDescription>
                      Sleep staging duration and restorative rest telemetry
                    </CardDescription>
                  </div>
                </CardHeader>
                <div className="p-4 rounded-2xl bg-surface-subtle/70 border border-border flex items-center justify-between mt-2">
                  <div>
                    <span className="text-xs text-text-muted">Last Recorded Sleep</span>
                    <p className="text-2xl font-bold text-text-primary tabular-nums font-display mt-0.5">
                      {sleepHours ? `${sleepHours} hours` : "No reading"}
                    </p>
                  </div>
                  <Badge variant="lavender" size="sm">
                    Optimal: 7 – 9 hrs
                  </Badge>
                </div>
              </Card>
            )}

            <div className="p-3.5 rounded-2xl bg-surface-subtle/50 border border-border/60 text-[11px] text-text-muted flex items-center gap-2">
              <Info className="h-4 w-4 text-text-muted shrink-0" />
              <span>
                All biometric data is encrypted at rest using platform-native AES-256 (SQLCipher/IndexedDB WebCrypto).
              </span>
            </div>
          </div>
        </div>
      </div>

      <ManualEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </AppShell>
  );
}

