import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { mobileApi } from "../services/api";
import { offlineSyncWorker } from "../services/sync/OfflineSyncWorker";
import { DashboardSummary, DailyBriefing } from "../types";

interface Props {
  onNavigateToManualEntry: () => void;
  onLogout: () => void;
}

export function DashboardScreen({ onNavigateToManualEntry, onLogout }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("Synced");

  const loadData = useCallback(async () => {
    try {
      const [sum, brief] = await Promise.allSettled([
        mobileApi.getDashboardSummary(),
        mobileApi.getDailyBriefing(),
      ]);
      if (sum.status === "fulfilled") setSummary(sum.value);
      if (brief.status === "fulfilled") setBriefing(brief.value);
    } catch {
      // Offline fallback
    }
  }, []);

  const handleSync = async () => {
    setIsRefreshing(true);
    setSyncStatus("Syncing...");
    try {
      const result = await offlineSyncWorker.executeSync();
      if (result.success) {
        setSyncStatus("Synced");
      } else {
        setSyncStatus("Offline / Retrying");
      }
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const METRICS = [
    { key: "heart_rate", label: "Heart Rate", unit: "bpm" },
    { key: "steps", label: "Steps", unit: "count" },
    { key: "sleep_session", label: "Sleep", unit: "hours" },
    { key: "active_energy", label: "Active Calories", unit: "kcal" },
    { key: "workout_session", label: "Workout", unit: "min" },
    { key: "resting_heart_rate", label: "Resting HR", unit: "bpm" },
    { key: "blood_pressure_systolic", label: "Blood Pressure (Sys)", unit: "mmHg" },
    { key: "blood_pressure_diastolic", label: "Blood Pressure (Dia)", unit: "mmHg" },
    { key: "oxygen_saturation", label: "SpO2", unit: "%" },
    { key: "blood_glucose", label: "Blood Glucose", unit: "mg/dL" },
  ];

  const formatValue = (key: string, val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    if (key === "sleep_session") return `${(val / 3600).toFixed(1)}`;
    if (key === "workout_session") return `${Math.round(val / 60)}`;
    if (key === "steps") return Math.round(val).toLocaleString();
    return val >= 100 ? Math.round(val).toString() : val.toFixed(1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleSync} tintColor="#6366F1" />}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>VitalSense</Text>
            <Text style={styles.syncStatusText}>Status: {syncStatus}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onNavigateToManualEntry}>
              <Text style={styles.actionBtnText}>+ Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutBtnText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily AI Briefing Card */}
        <View style={styles.briefingCard}>
          <View style={styles.briefingHeader}>
            <Text style={styles.briefingTitle}>Daily Intelligence Briefing</Text>
            <Text style={styles.briefingProvider}>{briefing?.provider || "Gemini AI"}</Text>
          </View>
          <Text style={styles.briefingHeadline}>
            {briefing?.headline || "Your Health Intelligence is Synchronized"}
          </Text>
          <Text style={styles.briefingSummary}>
            {briefing?.summary_text ||
              "All core metrics are recording smoothly. Continue tracking daily sleep duration and activity baselines."}
          </Text>

          {briefing?.recommendations && briefing.recommendations.length > 0 && (
            <View style={styles.recommendationsList}>
              {briefing.recommendations.map((rec, i) => (
                <Text key={i} style={styles.recommendationItem}>
                  • {rec}
                </Text>
              ))}
            </View>
          )}

          {/* Mandatory Non-Diagnostic Disclaimer */}
          <View style={styles.disclaimerContainer}>
            <Text style={styles.disclaimerText}>
              {briefing?.disclaimer ||
                "Insights are for educational and wellness tracking only, never medical diagnosis."}
            </Text>
          </View>
        </View>

        {/* Recovery Score Card */}
        <View style={styles.recoveryCard}>
          <Text style={styles.recoveryTitle}>Readiness & Recovery</Text>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNumber}>
              {summary?.recovery_score !== null && summary?.recovery_score !== undefined
                ? summary.recovery_score
                : "—"}
            </Text>
            <Text style={styles.scoreLabel}>/ 100</Text>
          </View>
          <Text style={styles.recoverySubtitle}>
            {summary?.recovery_score && summary.recovery_score >= 80
              ? "Optimal Recovery — Prime for Training"
              : summary?.recovery_score && summary.recovery_score >= 60
              ? "Moderate Recovery"
              : summary?.recovery_score
              ? "High Strain — Focus on Sleep"
              : "Calibrating baseline telemetry"}
          </Text>
        </View>

        {/* 10 Key Metrics Grid */}
        <Text style={styles.sectionTitle}>Key Health Telemetry</Text>
        <View style={styles.metricsGrid}>
          {METRICS.map((m) => {
            const data = summary?.metrics?.[m.key];
            return (
              <View key={m.key} style={styles.metricCard}>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <View style={styles.metricValueRow}>
                  <Text style={styles.metricValue}>{formatValue(m.key, data?.latest_value)}</Text>
                  <Text style={styles.metricUnit}>{m.unit}</Text>
                </View>
                <View style={styles.metricFooter}>
                  <Text style={styles.metricStatus}>{data?.status || "Normal"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  syncStatusText: {
    fontSize: 12,
    color: "#10B981",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  logoutBtn: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  briefingCard: {
    backgroundColor: "#131A2A",
    borderColor: "#312E81",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  briefingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  briefingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#818CF8",
  },
  briefingProvider: {
    fontSize: 10,
    color: "#A5B4FC",
    backgroundColor: "#1E1B4B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  briefingHeadline: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  briefingSummary: {
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  recommendationsList: {
    marginTop: 8,
  },
  recommendationItem: {
    fontSize: 12,
    color: "#E2E8F0",
    marginTop: 3,
  },
  disclaimerContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopColor: "#1E293B",
    borderTopWidth: 1,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  recoveryCard: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  recoveryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 12,
  },
  scoreCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#030712",
    borderColor: "#4F46E5",
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  scoreLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  recoverySubtitle: {
    fontSize: 12,
    color: "#D1D5DB",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#111827",
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginVertical: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  metricUnit: {
    fontSize: 10,
    color: "#6B7280",
  },
  metricFooter: {
    marginTop: 4,
  },
  metricStatus: {
    fontSize: 9,
    color: "#10B981",
    fontWeight: "600",
    textTransform: "uppercase",
  },
});

