"use client";

import React from "react";
import { Heart, Droplet, Activity, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { MetricSummary } from "../../lib/api";

export interface BodyMetricsModuleProps {
  metrics: Record<string, MetricSummary>;
  onLogVital?: () => void;
}

export function BodyMetricsModule({ metrics, onLogVital }: BodyMetricsModuleProps) {
  const rhr = metrics["resting_heart_rate"];
  const sys = metrics["blood_pressure_systolic"];
  const dia = metrics["blood_pressure_diastolic"];
  const spo2 = metrics["blood_oxygen_saturation"];
  const glucose = metrics["blood_glucose"];

  const hasPairedBP = sys?.latest_value && dia?.latest_value;

  const items = [
    {
      name: "Resting Heart Rate",
      value: rhr?.latest_value ? `${Math.round(rhr.latest_value)}` : null,
      unit: "bpm",
      status: rhr?.status,
      icon: Heart,
      iconColor: "text-coral bg-coral-soft",
    },
    {
      name: "Blood Pressure",
      value: hasPairedBP ? `${Math.round(sys!.latest_value!)} / ${Math.round(dia!.latest_value!)}` : null,
      unit: "mmHg",
      status: sys?.status || dia?.status,
      icon: Activity,
      iconColor: "text-brand bg-brand-soft",
    },
    {
      name: "Blood Oxygen (SpO2)",
      value: spo2?.latest_value ? `${spo2.latest_value.toFixed(1)}` : null,
      unit: "%",
      status: spo2?.status,
      icon: Droplet,
      iconColor: "text-blue bg-blue-soft",
    },
    {
      name: "Blood Glucose",
      value: glucose?.latest_value ? `${glucose.latest_value.toFixed(1)}` : null,
      unit: "mg/dL",
      status: glucose?.status,
      icon: Droplet,
      iconColor: "text-peach bg-peach-soft",
    },
  ];

  return (
    <Card variant="default">
      <CardHeader>
        <div>
          <CardTitle>Clinical & Body Metrics</CardTitle>
          <CardDescription>
            Cardiovascular and metabolic telemetry with baseline thresholds
          </CardDescription>
        </div>
        {onLogVital && (
          <button
            onClick={onLogVital}
            className="h-8 px-3 rounded-pill bg-surface-subtle hover:bg-surface-elevated border border-border text-xs font-medium text-text-primary flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-brand" />
            <span>Record Vital</span>
          </button>
        )}
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
        {items.map((item) => (
          <div
            key={item.name}
            className="p-4 rounded-2xl bg-surface-subtle/70 border border-border/70 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary">{item.name}</span>
              <div
                className={`h-7 w-7 rounded-pill flex items-center justify-center shrink-0 ${item.iconColor}`}
              >
                <item.icon className="h-3.5 w-3.5" />
              </div>
            </div>

            <div>
              {item.value ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums font-display">
                    {item.value}
                  </span>
                  <span className="text-xs text-text-muted font-medium">{item.unit}</span>
                </div>
              ) : (
                <span className="text-xs font-medium text-text-muted italic py-1 block">
                  No readings logged
                </span>
              )}
            </div>

            <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
              <span className="text-text-muted">Status</span>
              {item.status ? (
                <Badge size="sm" variant={item.status === "normal" ? "positive" : "warning"}>
                  {item.status}
                </Badge>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

