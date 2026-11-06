"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { ManualEntryModal } from "../ManualEntryModal";
import { WorkoutModal } from "../WorkoutModal";
import { ImportModal } from "../ImportModal";
import { PrivacyModal } from "../PrivacyModal";
import { api, PersonProfile } from "../../lib/api";
import { offlineStore } from "../../lib/offlineStore";

export interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onRefreshData?: () => void;
}

export function AppShell({
  children,
  title = "Dashboard",
  subtitle,
  onRefreshData,
}: AppShellProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");

  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Network state detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
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

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Load user profiles
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await api.family.listProfiles();
        if (res?.profiles && res.profiles.length > 0) {
          setProfiles(res.profiles);
          setActiveProfileId(res.profiles[0].id);
        }
      } catch {
        // Fallback for unauthenticated or single-user sessions
      }
    }
    fetchProfiles();
  }, []);

  // Trigger sync of pending queue
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const pending = await offlineStore.getPendingUploads();
      if (pending.length > 0) {
        await api.sync.syncBatch({
          device_id: "vitalsense_web_client",
          observations: pending.map((obs) => ({
            metric_name: obs.metric_name,
            value: obs.value,
            unit: obs.unit,
            measured_at: obs.measured_at,
            origin: "user_entered",
          })),
        });

        // Mark local items as synced
        for (const item of pending) {
          await offlineStore.markAsSynced(item.id);
        }
      }
      await updatePendingCount();
      onRefreshData?.();
    } catch {
      // Retain offline items for future retry
    } finally {
      setIsSyncing(false);
    }
  }, [updatePendingCount, onRefreshData]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    window.location.href = "/auth";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text-primary">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar onQuickAction={() => setIsManualModalOpen(true)} />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Universal Application Header */}
        <Header
          title={title}
          subtitle={subtitle}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          isSyncing={isSyncing}
          onSync={triggerSync}
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSelectProfile={setActiveProfileId}
          onLogout={handleLogout}
          onImportClick={() => setIsImportModalOpen(true)}
          onPrivacyClick={() => setIsPrivacyModalOpen(true)}
        />

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
          <div className="max-w-content mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Shared Modals */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => {
          updatePendingCount();
          onRefreshData?.();
        }}
      />
      <WorkoutModal
        isOpen={isWorkoutModalOpen}
        onClose={() => setIsWorkoutModalOpen(false)}
        onSuccess={() => onRefreshData?.()}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => onRefreshData?.()}
      />
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </div>
  );
}

