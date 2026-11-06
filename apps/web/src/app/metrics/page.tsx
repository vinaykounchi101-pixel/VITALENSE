"use client";

import React, { useState, useEffect } from "react";
import {
  Heart,
  Activity,
  Flame,
  Moon,
  Droplet,
  Dumbbell,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingState } from "../../components/ui/LoadingState";
import { api, DashboardSummary, MetricSummary } from "../../lib/api";

const METRIC_DEFINITIONS: Record<
  string,
  { name: string; unit: string; category: string; icon: any; variant: "coral" | "mint" | "lavender" | "peach" | "blue" }
> = {
  steps: { name: "Daily Steps", unit: "count", category: "Activity", icon: Activity, variant: "mint" },
  heart_rate: { name: "Heart Rate", unit: "bpm", category: "Cardiovascular", icon: Heart, variant: "coral" },
  sleep_session: { name: "Sleep Duration", unit: "seconds", category: "Recovery", icon: Moon, variant: "lavender" },
  active_energy: { name: "Active Energy", unit: "kcal", category: "Metabolic", icon: Flame, variant: "peach" },
  workout_session: { name: "Workout Sessions", unit: "seconds", category: "Fitness", icon: Dumbbell, variant: "blue" },
  resting_heart_rate: { name: "Resting Heart Rate", unit: "bpm", category: "Cardiovascular", icon: Heart, variant: "coral" },
  blood_pressure_systolic: { name: "Systolic Blood Pressure", unit: "mmHg", category: "Cardiovascular", icon: Activity, variant: "coral" },
  blood_pressure_diastolic: { name: "Diastolic Blood Pressure", unit: "mmHg", category: "Cardiovascular", icon: Activity, variant: "coral" },
  blood_oxygen_saturation: { name: "Blood Oxygen (SpO2)", unit: "percentage", category: "Respiratory", icon: Droplet, variant: "blue" },
  blood_glucose: { name: "Blood Glucose", unit: "mg/dL", category: "Metabolic", icon: Droplet, variant: "peach" },
};

export default function MetricsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

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

  const categories = ["All", "Cardiovascular", "Activity", "Recovery", "Metabolic", "Respiratory"];
  const metricsMap = summary?.metrics || {};

  const filteredKeys = Object.keys(METRIC_DEFINITIONS).filter((key) => {
    if (selectedCategory === "All") return true;
    return METRIC_DEFINITIONS[key].category === selectedCategory;
  });

  return (
    <AppShell
      title="Canonical Health Metrics"
      subtitle="Phase 1 standardized biometric measurements and validation thresholds"
      onRefreshData={loadData}
    >
      <div className="space-y-6">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-surface-elevated text-brand font-semibold border border-border shadow-xs"
                  : "bg-surface-subtle text-text-secondary hover:text-text-primary border border-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingState message="Loading metric telemetry..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredKeys.map((key) => {
              const def = METRIC_DEFINITIONS[key];
              const item: MetricSummary | undefined = metricsMap[key];
              const Icon = def.icon;
              const hasVal = item?.latest_value !== undefined && item?.latest_value !== null;

              // Format value according to unit
              let displayVal = "—";
              let displayUnit = def.unit;
              if (hasVal) {
                if (key === "sleep_session" || key === "workout_session") {
                  displayVal = (item!.latest_value! / 3600).toFixed(1);
                  displayUnit = "hrs";
                } else if (Number.isInteger(item!.latest_value!)) {
                  displayVal = item!.latest_value!.toLocaleString();
                } else {
                  displayVal = item!.latest_value!.toFixed(1);
                }
              }

              return (
                <Card key={key} variant="default" className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-pill bg-surface-subtle border border-border flex items-center justify-center text-brand">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-text-primary font-display">
                            {def.name}
                          </h4>
                          <span className="text-[10px] text-text-muted">{def.category}</span>
                        </div>
                      </div>
                      {item?.status && (
                        <Badge
                          size="sm"
                          variant={item.status === "normal" ? "positive" : "warning"}
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>

                    <div className="py-2">
                      <span className="text-2xl font-bold tracking-tight text-text-primary tabular-nums font-display">
                        {displayVal}
                      </span>
                      <span className="text-xs text-text-muted font-medium ml-1.5">
                        {displayUnit}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
                    <span>Baseline Avg:</span>
                    <span className="font-medium text-text-secondary tabular-nums">
                      {item?.rolling_7d_avg !== undefined && item?.rolling_7d_avg !== null
                        ? key === "sleep_session" || key === "workout_session"
                          ? `${(item.rolling_7d_avg / 3600).toFixed(1)} hrs`
                          : `${item.rolling_7d_avg.toFixed(1)} ${def.unit}`
                        : "Pending data"}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

