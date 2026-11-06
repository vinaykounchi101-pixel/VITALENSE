"use client";

import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { offlineStore } from "../lib/offlineStore";
import { Button } from "./ui/Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

const METRIC_CONFIG: Record<string, { label: string; unit: string; min: number; max: number }> = {
  steps: { label: "Steps", unit: "count", min: 0, max: 150000 },
  heart_rate: { label: "Heart Rate", unit: "bpm", min: 30, max: 250 },
  resting_heart_rate: { label: "Resting Heart Rate", unit: "bpm", min: 30, max: 200 },
  blood_pressure: { label: "Blood Pressure (Paired)", unit: "mmHg", min: 40, max: 260 },
  blood_oxygen_saturation: { label: "Blood Oxygen (SpO2)", unit: "percentage", min: 50, max: 100 },
  blood_glucose: { label: "Blood Glucose", unit: "mg/dL", min: 20, max: 600 },
  sleep_session: { label: "Sleep Duration", unit: "hours", min: 0.1, max: 24 },
  active_energy: { label: "Active Energy", unit: "kcal", min: 0, max: 10000 },
  workout_session: { label: "Workout Duration", unit: "minutes", min: 1, max: 720 },
};

export function ManualEntryModal({ isOpen, onClose, onSuccess, onSaved }: Props) {
  const [metricKey, setMetricKey] = useState("steps");
  const [value, setValue] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const measuredAt = new Date(timestamp).toISOString();
      const observations: any[] = [];

      if (metricKey === "blood_pressure") {
        const sysVal = parseFloat(systolic);
        const diaVal = parseFloat(diastolic);

        if (isNaN(sysVal) || isNaN(diaVal)) {
          throw new Error("Both Systolic and Diastolic values are required.");
        }
        if (sysVal <= diaVal) {
          throw new Error(`Systolic (${sysVal}) must strictly exceed Diastolic (${diaVal}).`);
        }

        observations.push(
          {
            metric_name: "blood_pressure_systolic",
            value: sysVal,
            unit: "mmHg",
            measured_at: measuredAt,
            origin: "user_entered",
          },
          {
            metric_name: "blood_pressure_diastolic",
            value: diaVal,
            unit: "mmHg",
            measured_at: measuredAt,
            origin: "user_entered",
          }
        );
      } else {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          throw new Error("A valid numerical value is required.");
        }

        const cfg = METRIC_CONFIG[metricKey];
        if (cfg) {
          if (numVal < cfg.min || numVal > cfg.max) {
            throw new Error(`Value for ${cfg.label} must be between ${cfg.min} and ${cfg.max} ${cfg.unit}.`);
          }
        }

        let finalValue = numVal;
        let finalUnit = cfg.unit;

        if (metricKey === "sleep_session") {
          finalValue = numVal * 3600;
          finalUnit = "seconds";
        } else if (metricKey === "workout_session") {
          finalValue = numVal * 60;
          finalUnit = "seconds";
        }

        observations.push({
          metric_name: metricKey,
          value: finalValue,
          unit: finalUnit,
          measured_at: measuredAt,
          origin: "user_entered",
        });
      }

      // Offline-first handling
      const isOnline = navigator.onLine;
      let syncSucceeded = false;

      if (isOnline) {
        try {
          await api.sync.syncBatch({
            device_id: "vitalsense_web_client",
            observations,
          });
          syncSucceeded = true;
        } catch {
          syncSucceeded = false;
        }
      }

      for (const obs of observations) {
        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        if (syncSucceeded) {
          await offlineStore.saveObservation({
            id: localId,
            metric_name: obs.metric_name,
            value: obs.value,
            unit: obs.unit,
            measured_at: obs.measured_at,
            sync_status: "synced",
          });
        } else {
          await offlineStore.queueObservation({
            id: localId,
            metric_name: obs.metric_name,
            value: obs.value,
            unit: obs.unit,
            measured_at: obs.measured_at,
            sync_status: "pending_upload",
          });
        }
      }

      (onSuccess || onSaved)?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log health measurement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6 text-text-primary shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h2 className="text-base font-semibold font-display">Log Health Observation</h2>
          <button
            onClick={onClose}
            className="rounded-pill p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/30 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Metric Category
            </label>
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-pill border border-border bg-surface-subtle text-text-primary text-xs focus:border-brand focus:outline-none"
            >
              {Object.entries(METRIC_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.label} ({cfg.unit})
                </option>
              ))}
            </select>
          </div>

          {metricKey === "blood_pressure" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Systolic (mmHg)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  className="w-full h-[44px] px-3.5 rounded-pill border border-border bg-surface-subtle text-text-primary text-xs focus:border-brand focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Diastolic (mmHg)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  className="w-full h-[44px] px-3.5 rounded-pill border border-border bg-surface-subtle text-text-primary text-xs focus:border-brand focus:outline-none"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Measurement Value ({METRIC_CONFIG[metricKey]?.unit})
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter numerical value"
                className="w-full h-[44px] px-3.5 rounded-pill border border-border bg-surface-subtle text-text-primary text-xs focus:border-brand focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Measurement Timestamp
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-pill border border-border bg-surface-subtle text-text-primary text-xs focus:border-brand focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button variant="subtle" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              Save Observation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
