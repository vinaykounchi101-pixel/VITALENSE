import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { mobileApi } from "./src/services/api";
import { AuthScreen } from "./src/screens/AuthScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { ManualEntryScreen } from "./src/screens/ManualEntryScreen";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "manual_entry">("dashboard");

  useEffect(() => {
    async function checkAuth() {
      try {
        const session = await mobileApi.getSession();
        setIsAuthenticated(!!session?.access_token);
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen onAuthSuccess={() => setIsAuthenticated(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {currentScreen === "dashboard" ? (
        <DashboardScreen
          onNavigateToManualEntry={() => setCurrentScreen("manual_entry")}
          onLogout={async () => {
            await mobileApi.logout();
            setIsAuthenticated(false);
          }}
        />
      ) : (
        <ManualEntryScreen onBack={() => setCurrentScreen("dashboard")} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B0F17",
    justifyContent: "center",
    alignItems: "center",
  },
});

