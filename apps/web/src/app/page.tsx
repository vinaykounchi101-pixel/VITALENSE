"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Heart,
  Activity,
  Flame,
  Moon,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  api,
  DashboardSummary,
  DailyBriefing,
  MetricTrend,
  HealthForecast,
  WorkoutDTO,
} from "../lib/api";
import { AppShell } from "../components/navigation/AppShell";
import { HeroPanel } from "../components/dashboard/HeroPanel";
import { MetricCard } from "../components/ui/MetricCard";
import { MetricChart } from "../components/MetricChart";
import { BodyMetricsModule } from "../components/dashboard/BodyMetricsModule";
import { RecentActivityModule } from "../components/dashboard/RecentActivityModule";
import { AIBriefingModule } from "../components/dashboard/AIBriefingModule";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { LoadingState } from "../components/ui/LoadingState";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutDTO[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>("heart_rate");
  const [trendDays, setTrendDays] = useState<number>(30);
  const [trendData, setTrendData] = useState<MetricTrend | null>(null);
  const [forecastData, setForecastData] = useState<HealthForecast | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTrendLoading, setIsTrendLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load primary dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [sumRes, briefRes, workRes] = await Promise.allSettled([
        api.analytics.getDashboardSummary(),
        api.intelligence.getDailyBriefing(),
        api.fitness.listWorkouts(),
      ]);

      if (sumRes.status === "fulfilled") {
        setSummary(sumRes.value);
      }
      if (briefRes.status === "fulfilled") {
        setBriefing(briefRes.value);
      }
      if (workRes.status === "fulfilled" && workRes.value?.workouts) {
        setWorkouts(workRes.value.workouts);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load dashboard telemetry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load trend & forecast for selected metric
  const loadTrendData = useCallback(async () => {
    setIsTrendLoading(true);
    try {
      const [trRes, fcRes] = await Promise.allSettled([
        api.analytics.getTrends(selectedMetric, trendDays),
        api.intelligence.getForecast(selectedMetric, 7),
      ]);

      if (trRes.status === "fulfilled") {
        setTrendData(trRes.value);
      } else {
        setTrendData(null);
      }

      if (fcRes.status === "fulfilled") {
        setForecastData(fcRes.value);
      } else {
        setForecastData(null);
      }
    } catch {
      setTrendData(null);
      setForecastData(null);
    } finally {
      setIsTrendLoading(false);
    }
  }, [selectedMetric, trendDays]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadTrendData();
  }, [loadTrendData]);

  const metrics = summary?.metrics || {};
  const hr = metrics["heart_rate"];
  const steps = metrics["steps"];
  const energy = metrics["active_energy"];
  const sleep = metrics["sleep_session"];

  return (
    <AppShell
      title="Personal Health Intelligence"
      subtitle="Unified biometric telemetry, recovery scores, and daily insights"
      onRefreshData={() => {
        loadDashboardData();
        loadTrendData();
      }}
    >
      {errorMsg && (
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-danger/10 border border-danger/30 p-4 text-xs text-danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button variant="subtle" size="sm" onClick={loadDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Connecting to secure biometric telemetry..." />
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 },
            },
          }}
          className="space-y-6 sm:space-y-8"
        >
          {/* 1. Hero Panel with greeting & Anatomical Health Visualization */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
          >
            <HeroPanel
              summary={summary}
              onViewBodyExplorer={() => {
                window.location.href = "/body";
              }}
            />
          </motion.div>

          {/* 2. Four Primary Pastel Metric Cards (Heart Rate, Steps, Energy, Sleep) */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <MetricCard
              title="Heart Rate"
              metricKey="heart_rate"
              value={hr?.latest_value}
              unit="bpm"
              changePct={hr?.change_from_baseline_pct}
              status={hr?.status}
              rollingAvg={hr?.rolling_7d_avg}
              variant="coral"
              icon={<Heart className="h-5 w-5 fill-current" />}
              isSelected={selectedMetric === "heart_rate"}
              onClick={() => setSelectedMetric("heart_rate")}
            />

            <MetricCard
              title="Daily Movement"
              metricKey="steps"
              value={steps?.latest_value}
              unit="steps"
              changePct={steps?.change_from_baseline_pct}
              status={steps?.status}
              rollingAvg={steps?.rolling_7d_avg}
              variant="mint"
              icon={<Activity className="h-5 w-5" />}
              isSelected={selectedMetric === "steps"}
              onClick={() => setSelectedMetric("steps")}
            />

            <MetricCard
              title="Active Energy"
              metricKey="active_energy"
              value={energy?.latest_value}
              unit="kcal"
              changePct={energy?.change_from_baseline_pct}
              status={energy?.status}
              rollingAvg={energy?.rolling_7d_avg}
              variant="peach"
              icon={<Flame className="h-5 w-5" />}
              isSelected={selectedMetric === "active_energy"}
              onClick={() => setSelectedMetric("active_energy")}
            />

            <MetricCard
              title="Sleep Recovery"
              metricKey="sleep_session"
              value={
                sleep?.latest_value
                  ? parseFloat((sleep.latest_value / 3600).toFixed(1))
                  : null
              }
              unit="hrs"
              changePct={sleep?.change_from_baseline_pct}
              status={sleep?.status}
              rollingAvg={
                sleep?.rolling_7d_avg
                  ? parseFloat((sleep.rolling_7d_avg / 3600).toFixed(1))
                  : null
              }
              variant="lavender"
              icon={<Moon className="h-5 w-5 fill-current" />}
              isSelected={selectedMetric === "sleep_session"}
              onClick={() => setSelectedMetric("sleep_session")}
            />
          </motion.div>

          {/* 3. Activity & Biometric Trend Analytics with Metric Selector */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
          >
            <Card variant="default">
              <CardHeader className="flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand" />
                    <span>Biometric Trajectory & Forecasting</span>
                  </CardTitle>
                  <CardDescription>
                    Multi-day rolling baseline comparison with machine-learning uncertainty projection
                  </CardDescription>
                </div>

                {/* Time Range Pills */}
                <div className="flex items-center rounded-pill bg-surface-subtle p-1 border border-border text-xs shrink-0">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => setTrendDays(days)}
                      className={`px-3 py-1 rounded-pill transition-all font-medium ${
                        trendDays === days
                          ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </CardHeader>

              {isTrendLoading ? (
                <div className="h-56 flex items-center justify-center text-xs text-text-muted">
                  Calculating biometric trajectory...
                </div>
              ) : (
                <MetricChart
                  metricName={selectedMetric}
                  unit={trendData?.canonical_unit || (selectedMetric === "sleep_session" ? "hours" : "units")}
                  historicalData={trendData?.data_points || []}
                  forecastData={forecastData?.projections || []}
                  baselineMean={trendData?.baseline_mean}
                />
              )}
            </Card>
          </motion.div>

          {/* 4. Grid: Clinical/Body Metrics & Recent Workouts */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <BodyMetricsModule metrics={metrics} />
            <RecentActivityModule workouts={workouts} />
          </motion.div>

          {/* 5. AI Daily Intelligence Briefing */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
          >
            <AIBriefingModule briefing={briefing} />
          </motion.div>
        </motion.div>
      )}
    </AppShell>
  );
}
