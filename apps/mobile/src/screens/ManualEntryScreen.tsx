import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { mobileStorage } from "../services/storage/sqlcipher";
import { offlineSyncWorker } from "../services/sync/OfflineSyncWorker";

interface Props {
  onBack: () => void;
}

export function ManualEntryScreen({ onBack }: Props) {
  const [metricKey, setMetricKey] = useState("heart_rate");
  const [value, setValue] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const METRICS = [
    { key: "heart_rate", label: "Heart Rate", unit: "bpm" },
    { key: "steps", label: "Steps", unit: "count" },
    { key: "sleep_session", label: "Sleep Duration", unit: "hours" },
    { key: "active_energy", label: "Active Calories", unit: "kcal" },
    { key: "workout_session", label: "Workout Duration", unit: "minutes" },
    { key: "blood_pressure", label: "Blood Pressure (Paired)", unit: "mmHg" },
    { key: "oxygen_saturation", label: "Blood Oxygen (SpO2)", unit: "%" },
    { key: "blood_glucose", label: "Blood Glucose", unit: "mg/dL" },
  ];

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      if (metricKey === "blood_pressure") {
        const sysVal = parseFloat(systolic);
        const diaVal = parseFloat(diastolic);
        if (isNaN(sysVal) || isNaN(diaVal) || sysVal <= diaVal) {
          Alert.alert("Invalid Input", "Systolic must be strictly greater than diastolic.");
          setIsSubmitting(false);
          return;
        }

        const readingId = `bp_${Date.now()}`;
        await mobileStorage.saveRecord({
          record_id: `rec_sys_${Date.now()}`,
          source_name: "vitalsense_mobile_app",
          source_record_id: `src_sys_${Date.now()}`,
          metric_name: "blood_pressure_systolic",
          numeric_value: sysVal,
          unit: "mmHg",
          measured_at: now,
          recorded_at: now,
          metadata_json: { paired_reading_id: readingId },
        });

        await mobileStorage.saveRecord({
          record_id: `rec_dia_${Date.now()}`,
          source_name: "vitalsense_mobile_app",
          source_record_id: `src_dia_${Date.now()}`,
          metric_name: "blood_pressure_diastolic",
          numeric_value: diaVal,
          unit: "mmHg",
          measured_at: now,
          recorded_at: now,
          metadata_json: { paired_reading_id: readingId },
        });
      } else {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          Alert.alert("Invalid Input", "Please enter a valid numeric value.");
          setIsSubmitting(false);
          return;
        }

        let canonicalValue = numVal;
        let canonicalUnit = "count";

        if (metricKey === "sleep_session") {
          canonicalValue = numVal * 3600;
          canonicalUnit = "seconds";
        } else if (metricKey === "workout_session") {
          canonicalValue = numVal * 60;
          canonicalUnit = "seconds";
        } else if (metricKey === "heart_rate") {
          canonicalUnit = "bpm";
        } else if (metricKey === "active_energy") {
          canonicalUnit = "kcal";
        } else if (metricKey === "blood_glucose") {
          canonicalUnit = "mg/dL";
        } else if (metricKey === "oxygen_saturation") {
          canonicalUnit = "%";
        }

        await mobileStorage.saveRecord({
          record_id: `rec_${Date.now()}`,
          source_name: "vitalsense_mobile_app",
          source_record_id: `src_${Date.now()}`,
          metric_name: metricKey,
          numeric_value: canonicalValue,
          unit: canonicalUnit,
          measured_at: now,
          recorded_at: now,
        });
      }

      // Trigger background sync drain
      offlineSyncWorker.executeSync().catch(() => {});

      Alert.alert("Success", "Health observation saved locally and queued for sync.");
      onBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Log Health Observation</Text>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Select Metric</Text>
        <View style={styles.metricPicker}>
          {METRICS.map((m) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMetricKey(m.key)}
              style={[styles.metricChip, metricKey === m.key && styles.metricChipActive]}
            >
              <Text style={[styles.metricChipText, metricKey === m.key && styles.metricChipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {metricKey === "blood_pressure" ? (
          <View style={styles.inputSection}>
            <Text style={styles.label}>Systolic (mmHg)</Text>
            <TextInput
              style={styles.input}
              placeholder="120"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={systolic}
              onChangeText={setSystolic}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>Diastolic (mmHg)</Text>
            <TextInput
              style={styles.input}
              placeholder="80"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={diastolic}
              onChangeText={setDiastolic}
            />
          </View>
        ) : (
          <View style={styles.inputSection}>
            <Text style={styles.label}>
              Value ({METRICS.find((m) => m.key === metricKey)?.unit})
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter measurement"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={value}
              onChangeText={setValue}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Text style={styles.saveBtnText}>
            {isSubmitting ? "Recording..." : "Save to Encrypted Vault"}
          </Text>
        </TouchableOpacity>
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  cancelText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  metricPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  metricChip: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  metricChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#6366F1",
  },
  metricChipText: {
    color: "#CBD5E1",
    fontSize: 12,
  },
  metricChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  inputSection: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  saveBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});

