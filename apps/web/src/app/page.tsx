"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Heart,
  Moon,
  Flame,
  Dumbbell,
  Droplet,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Shield,
  Upload,
  PlusCircle,
  RefreshCw,
  LogOut,
  Users,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  api,
  DashboardSummary,
  DailyBriefing,
  MetricTrend,
  HealthForecast,
  PersonProfile,
} from "../lib/api";
import { offlineStore, CachedObservation } from "../lib/offlineStore";
import { ManualEntryModal } from "../components/ManualEntryModal";
import { WorkoutModal } from "../components/WorkoutModal";
import { ImportModal } from "../components/ImportModal";
import { PrivacyModal } from "../components/PrivacyModal";
import { MetricChart } from "../components/MetricChart";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("heart_rate");
  const [trendData, setTrendData] = useState<MetricTrend | null>(null);
  const [forecastData, setForecastData] = useState<HealthForecast | null>(null);

  // Offline & sync states
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Network state listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      triggerPendingSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending queue count
  const updatePendingCount = useCallback(async () => {
    try {
      const pending = await offlineStore.getPendingUploads();
      setPendingSyncCount(pending.length);
    } catch {
      // IndexedDB might not be available in SSR
    }
  }, []);

  // Drains pending offline queue to server
  const triggerPendingSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const pending = await offlineStore.getPendingUploads();
      if (pending.length > 0) {
        const batchRecords = pending.map((obs) => ({
          record_id: obs.id,
          source_name: "vitalsense_web_client",
          source_record_id: obs.id,
          metric_name: obs.metric_name,
          numeric_value: obs.value,
          unit: obs.unit,
          measured_at: obs.measured_at,
          recorded_at: new Date().toISOString(),
          metadata_json: { offline_queued: true },
        }));

        await api.sync.syncBatch({
          client_sync_token: `web_drain_${Date.now()}`,
          records: batchRecords,
          deletions: [],
        });

        await offlineStore.markAsSynced(pending.map((p) => p.id));
        await updatePendingCount();
        fetchDashboardData();
      }
    } catch (err) {
      console.error("Offline sync drain failed", err);
    } finally {
      setIsSyncing(false);
    }
  }, [updatePendingCount]);

  // Load dashboard overview data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [sum, brief, profs] = await Promise.allSettled([
        api.analytics.getDashboardSummary(),
        api.intelligence.getDailyBriefing(),
        api.family.listProfiles(),
      ]);

      if (sum.status === "fulfilled") setSummary(sum.value);
      if (brief.status === "fulfilled") setBriefing(brief.value);
      if (profs.status === "fulfilled" && profs.value?.profiles) {
        setProfiles(profs.value.profiles);
        if (!activeProfileId && profs.value.profiles.length > 0) {
          const primary = profs.value.profiles.find((p) => p.is_primary) || profs.value.profiles[0];
          setActiveProfileId(primary.id);
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setIsLoading(false);
      updatePendingCount();
    }
  }, [activeProfileId, updatePendingCount]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Load trend and forecast when selectedMetric changes
  useEffect(() => {
    let isSubscribed = true;
    async function loadMetricDetails() {
      try {
        const [trend, forecast] = await Promise.allSettled([
          api.analytics.getTrends(selectedMetric, 30),
          api.intelligence.getForecast(selectedMetric, 7),
        ]);
        if (!isSubscribed) return;
        if (trend.status === "fulfilled") setTrendData(trend.value);
        if (forecast.status === "fulfilled") setForecastData(forecast.value);
      } catch (err) {
        console.error("Failed to load metric details", err);
      }
    }
    loadMetricDetails();
    return () => {
      isSubscribed = false;
    };
  }, [selectedMetric]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      window.location.href = "/auth";
    }
  };

  // Metric Icon and Title helper
  const getMetricMeta = (name: string) => {
    switch (name) {
      case "heart_rate":
        return { label: "Heart Rate", icon: Heart, color: "text-rose-400", unit: "bpm" };
      case "steps":
        return { label: "Steps", icon: Activity, color: "text-blue-400", unit: "count" };
      case "sleep_session":
        return { label: "Sleep Duration", icon: Moon, color: "text-indigo-400", unit: "seconds" };
      case "active_energy":
        return { label: "Active Calories", icon: Flame, color: "text-orange-400", unit: "kcal" };
      case "workout_session":
        return { label: "Workout", icon: Dumbbell, color: "text-emerald-400", unit: "seconds" };
      case "resting_heart_rate":
        return { label: "Resting HR", icon: Heart, color: "text-pink-400", unit: "bpm" };
      case "blood_pressure_systolic":
        return { label: "Blood Pressure (Sys)", icon: Droplet, color: "text-cyan-400", unit: "mmHg" };
      case "blood_pressure_diastolic":
        return { label: "Blood Pressure (Dia)", icon: Droplet, color: "text-cyan-400", unit: "mmHg" };
      case "oxygen_saturation":
        return { label: "Oxygen Saturation (SpO2)", icon: Activity, color: "text-teal-400", unit: "%" };
      case "blood_glucose":
        return { label: "Blood Glucose", icon: Droplet, color: "text-violet-400", unit: "mg/dL" };
      default:
        return { label: name.replace(/_/g, " "), icon: Activity, color: "text-slate-400", unit: "" };
    }
  };

  // Format metric value for presentation
  const formatMetricDisplay = (name: string, val: number | null) => {
    if (val === null || val === undefined) return "—";
    if (name === "sleep_session") {
      const hours = val / 3600;
      return `${hours.toFixed(1)} hrs`;
    }
    if (name === "workout_session") {
      const mins = Math.round(val / 60);
      return `${mins} min`;
    }
    if (name === "steps") {
      return Math.round(val).toLocaleString();
    }
    return val >= 100 ? Math.round(val).toString() : val.toFixed(1);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0B0F17]/90 backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">VitalSense</span>
              <span className="ml-2 rounded-md bg-indigo-950 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-800/60">
                PROD
              </span>
            </div>
          </div>

          {/* Center Actions */}
          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5 text-indigo-400" />
              <span>Log Metric</span>
            </button>
            <button
              onClick={() => setIsWorkoutModalOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Dumbbell className="h-3.5 w-3.5 text-emerald-400" />
              <span>Log Workout</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-blue-400" />
              <span>Import Archive</span>
            </button>
          </div>

          {/* Right Status & Profile Controls */}
          <div className="flex items-center space-x-3">
            {/* Sync Status Badge */}
            <div
              onClick={triggerPendingSync}
              title={isOnline ? "Click to trigger manual sync" : "Offline mode — data queued locally"}
              className={`flex items-center space-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium border cursor-pointer transition-colors ${
                isOnline
                  ? pendingSyncCount > 0
                    ? "border-amber-800/60 bg-amber-950/40 text-amber-300"
                    : "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span>{pendingSyncCount > 0 ? `${pendingSyncCount} Pending` : "Synced"}</span>
                  {isSyncing && <RefreshCw className="h-3 w-3 animate-spin text-amber-400 ml-1" />}
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-slate-500" />
                  <span>Offline ({pendingSyncCount})</span>
                </>
              )}
            </div>

            {/* Profile Switcher */}
            {profiles.length > 0 && (
              <div className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={activeProfileId}
                  onChange={(e) => setActiveProfileId(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                      {p.display_name} {p.is_primary ? "(Primary)" : `(${p.relationship_type})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Privacy Controls */}
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              title="Privacy & Data Management"
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Shield className="h-4 w-4" />
            </button>

            {/* Sign Out */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto max-w-7xl w-full p-6 space-y-6">
        {/* Top Hero / Briefing Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily AI Intelligence Briefing Card (2 cols on large) */}
          <div className="lg:col-span-2 rounded-2xl border border-indigo-900/40 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-900 p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-950/80">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                <h2 className="text-base font-semibold text-white">Daily Intelligence Briefing</h2>
              </div>
              <span className="rounded-full bg-indigo-950/80 border border-indigo-800/60 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300">
                {briefing?.provider || "Gemini AI Engine"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-slate-100">
                {briefing?.headline || "Your Health System is Synchronized"}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {briefing?.summary_text ||
                  "Daily observations are recording normally. Continue consistent logging of sleep duration and resting heart rate for deep statistical baseline calibration."}
              </p>

              {briefing?.recommendations && briefing.recommendations.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Actionable Focus Areas
                  </h4>
                  <ul className="space-y-1.5">
                    {briefing.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start space-x-2 text-xs text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mandatory Medical Disclaimer Banner */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center space-x-2 text-[11px] text-slate-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
                <span>
                  {briefing?.disclaimer ||
                    "Insights are for educational and wellness tracking only, never medical diagnosis."}
                </span>
              </div>
            </div>
          </div>

          {/* Recovery Score & Readiness Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-300">Readiness & Recovery</span>
                <span className="text-xs text-slate-500">0 - 100 Score</span>
              </div>

              <div className="flex flex-col items-center justify-center my-6">
                <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-4 border-slate-800 bg-slate-950/60 shadow-inner">
                  <span className="text-4xl font-extrabold text-white">
                    {summary?.recovery_score !== null && summary?.recovery_score !== undefined
                      ? summary.recovery_score
                      : "—"}
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-400 mt-3">
                  {summary?.recovery_score && summary.recovery_score >= 80
                    ? "Optimal Physical Recovery"
                    : summary?.recovery_score && summary.recovery_score >= 60
                    ? "Moderate Recovery — Light Strain"
                    : summary?.recovery_score
                    ? "High Strain — Focus on Sleep"
                    : "Awaiting baseline sleep & HR data"}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Days Tracked: {summary?.days_tracked ?? 0}</span>
              <span>Data Quality: {summary?.data_quality_score ?? 100}%</span>
            </div>
          </div>
        </div>

        {/* 10 Canonical Metric Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Key Health Metrics & Observations
            </h3>
            <span className="text-xs text-slate-500">Click any metric to inspect trends and forecasts</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              "heart_rate",
              "steps",
              "sleep_session",
              "active_energy",
              "workout_session",
              "resting_heart_rate",
              "blood_pressure_systolic",
              "blood_pressure_diastolic",
              "oxygen_saturation",
              "blood_glucose",
            ].map((metricKey) => {
              const meta = getMetricMeta(metricKey);
              const data = summary?.metrics?.[metricKey];
              const isSelected = selectedMetric === metricKey;
              const Icon = meta.icon;

              return (
                <div
                  key={metricKey}
                  onClick={() => setSelectedMetric(metricKey)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 truncate">{meta.label}</span>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>

                  <div className="mt-3 flex items-baseline space-x-1.5">
                    <span className="text-xl font-bold text-white">
                      {formatMetricDisplay(metricKey, data?.latest_value ?? null)}
                    </span>
                    {data?.latest_value !== null && data?.latest_value !== undefined && meta.unit !== "seconds" && (
                      <span className="text-[10px] text-slate-500">{data?.unit || meta.unit}</span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center space-x-1">
                      {data?.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                      ) : data?.trend === "down" ? (
                        <TrendingDown className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Minus className="h-3 w-3 text-slate-500" />
                      )}
                      <span>{data?.rolling_7d_avg ? `${data.rolling_7d_avg.toFixed(1)} avg` : "—"}</span>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                        data?.status === "optimal"
                          ? "bg-emerald-950/60 text-emerald-400"
                          : data?.status === "caution"
                          ? "bg-amber-950/60 text-amber-400"
                          : data?.status === "critical"
                          ? "bg-rose-950/60 text-rose-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {data?.status || "Normal"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Trend and Forecast Section */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-white">
                  {getMetricMeta(selectedMetric).label} — Historical Trends & Predictive Forecast
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Model: <span className="text-indigo-400 font-medium">{forecastData?.model_type || "Statistical Linear Extrapolation"}</span> | Trend Direction:{" "}
                <span className="text-slate-300 font-medium">{forecastData?.trend_direction || "Stable"}</span>
              </p>
            </div>

            {/* Metric Switcher Tab Bar */}
            <div className="flex flex-wrap gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {["heart_rate", "steps", "sleep_session", "blood_glucose", "blood_pressure_systolic"].map((mKey) => (
                <button
                  key={mKey}
                  onClick={() => setSelectedMetric(mKey)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    selectedMetric === mKey
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {getMetricMeta(mKey).label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="mt-4">
            <MetricChart
              metricName={selectedMetric}
              unit={trendData?.canonical_unit || getMetricMeta(selectedMetric).unit}
              historicalData={trendData?.data_points || []}
              forecastData={forecastData?.projections || []}
              baselineMean={trendData?.baseline_mean}
            />
          </div>

          {/* Forecast details banner */}
          {forecastData && (
            <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between rounded-xl bg-slate-800/40 border border-slate-800 p-3.5 text-xs text-slate-400 gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-300">
                  Forecast Window: {forecastData.forecast_days} days ahead
                </span>
                <span>•</span>
                <span>History Used: {forecastData.history_days_used} days</span>
                <span>•</span>
                <span>Anomalies Detected: {forecastData.anomalies_detected}</span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                {forecastData.disclaimer}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0B0F17] py-6 px-6 text-center text-xs text-slate-500">
        <p>VitalSense Health Intelligence Platform • Confidential Personal Health Storage • Version 0.7.2-sprint</p>
      </footer>

      {/* Modals */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSaved={() => {
          fetchDashboardData();
          updatePendingCount();
        }}
      />
      <WorkoutModal
        isOpen={isWorkoutModalOpen}
        onClose={() => setIsWorkoutModalOpen(false)}
        onSaved={fetchDashboardData}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={fetchDashboardData}
      />
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </div>
  );
}
