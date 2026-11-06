"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, Sparkles, Info, Activity } from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { MetricChart } from "../../components/MetricChart";
import { LoadingState } from "../../components/ui/LoadingState";
import { api, MetricTrend, HealthForecast } from "../../lib/api";

const METRICS = [
  { id: "heart_rate", label: "Heart Rate (bpm)" },
  { id: "steps", label: "Daily Steps" },
  { id: "active_energy", label: "Active Energy (kcal)" },
  { id: "sleep_session", label: "Sleep Duration" },
  { id: "resting_heart_rate", label: "Resting Heart Rate" },
  { id: "blood_oxygen_saturation", label: "Blood Oxygen (SpO2)" },
  { id: "blood_glucose", label: "Blood Glucose" },
];

export default function TrendsPage() {
  const [selectedMetric, setSelectedMetric] = useState("heart_rate");
  const [days, setDays] = useState(30);
  const [trend, setTrend] = useState<MetricTrend | null>(null);
  const [forecast, setForecast] = useState<HealthForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrends = async () => {
    setIsLoading(true);
    try {
      const [tRes, fRes] = await Promise.allSettled([
        api.analytics.getTrends(selectedMetric, days),
        api.intelligence.getForecast(selectedMetric, 7),
      ]);
      if (tRes.status === "fulfilled") setTrend(tRes.value);
      if (fRes.status === "fulfilled") setForecast(fRes.value);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [selectedMetric, days]);

  return (
    <AppShell
      title="Biometric Trends & Projections"
      subtitle="Rolling statistical baselines and 7-day algorithmic trajectory forecasting"
      onRefreshData={fetchTrends}
    >
      <div className="space-y-6">
        {/* Metric Selector & Range Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
          <div className="flex flex-wrap items-center gap-2">
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMetric(m.id)}
                className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-all ${
                  selectedMetric === m.id
                    ? "bg-brand text-white font-semibold shadow-xs"
                    : "bg-surface-subtle text-text-secondary hover:text-text-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-pill bg-surface-subtle p-1 border border-border text-xs shrink-0">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-pill transition-all font-medium ${
                  days === d
                    ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Chart View */}
        <Card variant="default">
          <CardHeader>
            <div>
              <CardTitle className="capitalize">
                {selectedMetric.replace(/_/g, " ")} Historical Trajectory
              </CardTitle>
              <CardDescription>
                Solid line: verified measurements. Dashed line: 7d rolling average. Orange line: 95% confidence projection.
              </CardDescription>
            </div>
            {forecast?.trend_direction && (
              <Badge variant="mint" size="sm" className="capitalize">
                Trend: {forecast.trend_direction}
              </Badge>
            )}
          </CardHeader>

          {isLoading ? (
            <LoadingState message="Calculating trend curves..." />
          ) : (
            <MetricChart
              metricName={selectedMetric}
              unit={trend?.canonical_unit || "units"}
              historicalData={trend?.data_points || []}
              forecastData={forecast?.projections || []}
              baselineMean={trend?.baseline_mean}
            />
          )}
        </Card>

        {/* Statistical Insights & Forecast Properties */}
        {forecast && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card variant="subtle" className="p-4">
              <span className="text-[11px] font-medium text-text-muted">Trend Slope</span>
              <p className="text-lg font-bold text-text-primary mt-1 font-display">
                {forecast.trend_slope_per_day > 0
                  ? `+${forecast.trend_slope_per_day.toFixed(2)}`
                  : forecast.trend_slope_per_day.toFixed(2)}
                <span className="text-xs font-normal text-text-muted ml-1">/ day</span>
              </p>
            </Card>

            <Card variant="subtle" className="p-4">
              <span className="text-[11px] font-medium text-text-muted">Anomalies Detected</span>
              <p className="text-lg font-bold text-text-primary mt-1 font-display">
                {forecast.anomalies_detected}
                <span className="text-xs font-normal text-text-muted ml-1">events</span>
              </p>
            </Card>

            <Card variant="subtle" className="p-4">
              <span className="text-[11px] font-medium text-text-muted">Model Architecture</span>
              <p className="text-xs font-semibold text-text-primary mt-1.5 font-display">
                {forecast.model_type || "ARIMA / Holt-Winters Baseline"}
              </p>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

