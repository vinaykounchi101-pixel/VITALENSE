"use client";

import React, { useState, useEffect } from "react";
import { Moon, Sparkles, Clock, BedDouble, Info } from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { MetricChart } from "../../components/MetricChart";
import { LoadingState } from "../../components/ui/LoadingState";
import { api, DashboardSummary, MetricTrend } from "../../lib/api";

export default function SleepPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<MetricTrend | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sRes, tRes] = await Promise.allSettled([
        api.analytics.getDashboardSummary(),
        api.analytics.getTrends("sleep_session", 30),
      ]);
      if (sRes.status === "fulfilled") setSummary(sRes.value);
      if (tRes.status === "fulfilled") setTrend(tRes.value);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sleep = summary?.metrics?.["sleep_session"];
  const latestHours = sleep?.latest_value ? (sleep.latest_value / 3600).toFixed(1) : null;
  const avgHours = sleep?.rolling_7d_avg ? (sleep.rolling_7d_avg / 3600).toFixed(1) : null;

  // Convert trend data points from seconds to hours for display
  const convertedTrendPoints = (trend?.data_points || []).map((p) => ({
    ...p,
    value: parseFloat((p.value / 3600).toFixed(2)),
    rolling_avg: p.rolling_avg !== undefined ? parseFloat((p.rolling_avg / 3600).toFixed(2)) : undefined,
  }));

  const baselineHours = trend?.baseline_mean !== undefined ? parseFloat((trend.baseline_mean / 3600).toFixed(2)) : undefined;

  return (
    <AppShell
      title="Sleep Architecture & Recovery"
      subtitle="Circadian duration tracking, nocturnal baselines, and sleep debt analysis"
      onRefreshData={loadData}
    >
      <div className="space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="default" className="p-5">
            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <Moon className="h-4 w-4 text-lavender" /> Latest Sleep Session
            </span>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-2 tabular-nums font-display">
              {latestHours ? latestHours : "—"}
              <span className="text-xs font-normal text-text-muted ml-1.5">hours</span>
            </p>
            <div className="pt-2 mt-2 border-t border-border/60 text-[11px] text-text-muted">
              Status: {sleep?.status ? <span className="capitalize font-medium text-text-primary">{sleep.status}</span> : "Pending baseline"}
            </div>
          </Card>

          <Card variant="default" className="p-5">
            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue" /> 7-Day Rolling Average
            </span>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-2 tabular-nums font-display">
              {avgHours ? avgHours : "—"}
              <span className="text-xs font-normal text-text-muted ml-1.5">hours</span>
            </p>
            <div className="pt-2 mt-2 border-t border-border/60 text-[11px] text-text-muted">
              Recommended: 7.0 – 9.0 hrs
            </div>
          </Card>

          <Card variant="default" className="p-5">
            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 text-brand" /> Sleep Baseline Status
            </span>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-2 tabular-nums font-display capitalize">
              {sleep?.status && sleep.status !== "insufficient_data" ? sleep.status : "—"}
            </p>
            <div className="pt-2 mt-2 border-t border-border/60 text-[11px] text-text-muted">
              {sleep?.status && sleep.status !== "insufficient_data"
                ? "Evaluated against 7-day rolling window"
                : "Awaiting multi-day baseline recordings"}
            </div>
          </Card>
        </div>

        {/* 30-Day Sleep Duration Chart */}
        <Card variant="default">
          <CardHeader>
            <div>
              <CardTitle>Sleep Duration History (30 Days)</CardTitle>
              <CardDescription>
                Chronological sleep recording duration in hours per night
              </CardDescription>
            </div>
            <Badge variant="lavender" size="sm">
              Hours / Night
            </Badge>
          </CardHeader>

          {isLoading ? (
            <LoadingState message="Retrieving sleep history..." />
          ) : (
            <MetricChart
              metricName="sleep_session"
              unit="hours"
              historicalData={convertedTrendPoints}
              baselineMean={baselineHours}
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}

