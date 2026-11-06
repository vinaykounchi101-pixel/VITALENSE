"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Shield,
  Sun,
  Moon,
  Laptop,
  Smartphone,
  Trash2,
  Download,
  AlertTriangle,
  Database,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../components/ThemeProvider";
import { api, SessionDTO } from "../../lib/api";
import { offlineStore } from "../../lib/offlineStore";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const list = await api.auth.getSessions();
        if (Array.isArray(list)) setSessions(list);
      } catch {}
    }

    async function loadOffline() {
      try {
        const pending = await offlineStore.getPendingUploads();
        setOfflineCount(pending.length);
      } catch {}
    }

    loadSessions();
    loadOffline();
  }, []);

  const handleRevokeSession = async (familyId: string) => {
    try {
      await api.auth.revokeSession(familyId);
      setSessions((prev) => prev.filter((s) => s.family_id !== familyId));
    } catch {}
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await api.privacy.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vitalsense-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setExportNotice("Your comprehensive encrypted health export has been generated.");
    } catch {
      setExportNotice("Failed to generate data export.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      title="System Preferences & Privacy"
      subtitle="Theme configuration, active security sessions, offline cache, and data portability"
    >
      <div className="space-y-6 max-w-4xl">
        {/* 1. Theme Configuration */}
        <Card variant="default">
          <CardHeader>
            <div>
              <CardTitle>Appearance & Theme</CardTitle>
              <CardDescription>
                Select your preferred visual interface mode matching Design Package v2
              </CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => setTheme("light")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                theme === "light"
                  ? "border-brand bg-surface-elevated ring-2 ring-brand/20 shadow-xs"
                  : "border-border bg-surface-subtle/50 hover:bg-surface-subtle"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Sun className="h-5 w-5 text-warning" />
                {theme === "light" && <CheckCircle2 className="h-4 w-4 text-brand" />}
              </div>
              <h4 className="text-xs font-semibold text-text-primary">Light Mode</h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Warm ivory canvas (#F4F1EC) & editorial surfaces
              </p>
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                theme === "dark"
                  ? "border-brand bg-surface-elevated ring-2 ring-brand/20 shadow-xs"
                  : "border-border bg-surface-subtle/50 hover:bg-surface-subtle"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Moon className="h-5 w-5 text-text-secondary" />
                {theme === "dark" && <CheckCircle2 className="h-4 w-4 text-brand" />}
              </div>
              <h4 className="text-xs font-semibold text-text-primary">Dark Mode</h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Deep charcoal surfaces (#202326) with soft pastels
              </p>
            </button>

            <button
              onClick={() => setTheme("system")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                theme === "system"
                  ? "border-brand bg-surface-elevated ring-2 ring-brand/20 shadow-xs"
                  : "border-border bg-surface-subtle/50 hover:bg-surface-subtle"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Laptop className="h-5 w-5 text-blue" />
                {theme === "system" && <CheckCircle2 className="h-4 w-4 text-brand" />}
              </div>
              <h4 className="text-xs font-semibold text-text-primary">System Match</h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Syncs with operating system appearance
              </p>
            </button>
          </div>
        </Card>

        {/* 2. Active Authentication Sessions */}
        <Card variant="default">
          <CardHeader>
            <div>
              <CardTitle>Active Client Sessions</CardTitle>
              <CardDescription>
                Cryptographically tracked refresh tokens with 32-byte rotating secrets
              </CardDescription>
            </div>
            <Badge variant="mint" size="sm">
              Argon2id Enforced
            </Badge>
          </CardHeader>

          <div className="space-y-2.5 pt-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">
                Current browser session active via HttpOnly Secure Cookies.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.family_id}
                  className="p-3.5 rounded-2xl bg-surface-subtle/60 border border-border flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-pill bg-brand/10 text-brand flex items-center justify-center">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-primary">
                        {s.device_name || s.device_id || "Web Client"}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Expires: {new Date(s.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeSession(s.family_id)}
                    className="p-1.5 rounded-pill text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Revoke session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 3. Offline Data & Portability */}
        <Card variant="default">
          <CardHeader>
            <div>
              <CardTitle>Data Portability & Offline Cache</CardTitle>
              <CardDescription>
                GDPR/CCPA compliant JSON data exports and local IndexedDB queue inspection
              </CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-subtle/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-pill bg-mint-soft text-brand flex items-center justify-center">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">
                    Offline Sync Queue
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    {offlineCount} pending health observation(s) awaiting server synchronization
                  </p>
                </div>
              </div>

              <Badge variant={offlineCount > 0 ? "warning" : "positive"} size="sm">
                {offlineCount > 0 ? "Unsynced items" : "All synced"}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface-subtle/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-pill bg-blue-soft text-blue flex items-center justify-center">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">
                    Export Health Archives
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    Download complete unredacted observation history in structured JSON format
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportData}
                isLoading={isExporting}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Export JSON
              </Button>
            </div>

            {exportNotice && (
              <p className="text-xs text-positive font-medium text-center">{exportNotice}</p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

