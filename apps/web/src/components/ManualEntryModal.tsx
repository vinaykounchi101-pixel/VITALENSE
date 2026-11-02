"use client";

import React, { useState } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { offlineStore } from "@/lib/offlineStore";

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
          },
          {
            metric_name: "blood_pressure_diastolic",
            value: diaVal,
            unit: "mmHg",
            measured_at: measuredAt,
          }
        );
      } else {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          throw new Error("Please enter a valid numeric measurement.");
        }
        const cfg = METRIC_CONFIG[metricKey];
        if (numVal < cfg.min || numVal > cfg.max) {
          throw new Error(`Value must be between ${cfg.min} and ${cfg.max} ${cfg.unit}.`);
        }

        let canonicalValue = numVal;
        let canonicalUnit = cfg.unit;

        // Convert duration to canonical unit seconds
        if (metricKey === "sleep_session") {
          canonicalValue = numVal * 3600.0;
          canonicalUnit = "seconds";
        } else if (metricKey === "workout_session") {
          canonicalValue = numVal * 60.0;
          canonicalUnit = "seconds";
        }

        observations.push({
          metric_name: metricKey,
          value: canonicalValue,
          unit: canonicalUnit,
          measured_at: measuredAt,
        });
      }

      // Try online sync first
      try {
        await api.sync.syncBatch({
          device_id: "web-client-manual",
          observations,
        });
      } catch (err: any) {
        // Fallback to offline store if network fails
        for (const obs of observations) {
          await offlineStore.saveObservation({
            id: `offline-${Date.now()}-${Math.random()}`,
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
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold">Log Health Observation</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Metric Category</label>
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
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
                <label className="block text-sm font-medium text-slate-300">Systolic (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Diastolic (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Measurement Value ({METRIC_CONFIG[metricKey]?.unit})
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter numerical value"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300">Measurement Timestamp</label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-sky-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
