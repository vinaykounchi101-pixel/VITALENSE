import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { mobileApi } from "../services/api";

interface Props {
  onAuthSuccess: () => void;
}

export function AuthScreen({ onAuthSuccess }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Required Fields", "Please enter both email and password.");
      return;
    }

    if (isRegister && password.length < 12) {
      Alert.alert("Weak Password", "Password must be at least 12 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        await mobileApi.register({ email, password });
      } else {
        await mobileApi.login({ email, password });
      }
      onAuthSuccess();
    } catch (err: any) {
      Alert.alert("Authentication Failed", err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>VitalSense</Text>
          <Text style={styles.tagline}>Privacy-First Personal Health Intelligence</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{isRegister ? "Create Account" : "Sign In"}</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="user@example.com"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••••"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitBtnText}>
              {isLoading ? "Authenticating..." : isRegister ? "Create Account" : "Sign In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => setIsRegister(!isRegister)}
          >
            <Text style={styles.switchBtnText}>
              {isRegister ? "Already have an account? Sign In" : "Need an account? Create one"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  brand: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  tagline: {
    fontSize: 12,
    color: "#818CF8",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  submitBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  switchBtn: {
    marginTop: 16,
    alignItems: "center",
  },
  switchBtnText: {
    color: "#818CF8",
    fontSize: 12,
  },
});

