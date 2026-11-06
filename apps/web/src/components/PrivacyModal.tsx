"use client";

import React, { useState } from "react";
import { ShieldCheck, Download, Trash2, AlertTriangle, X, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "delete">("export");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const data = await api.privacy.exportData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vitalsense_gdpr_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
    } catch (err: any) {
      alert("Failed to export personal data: " + (err.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) return;

    if (
      !confirm(
        "Are you ABSOLUTELY sure? This will permanently delete your account, credentials, and all health records across all profiles. This action CANNOT be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.privacy.deleteAccount(deletePassword);
      alert("Your account and all associated personal health data have been permanently erased.");
      window.location.href = "/auth";
    } catch (err: any) {
      setDeleteError(err.message || "Account deletion failed.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-6 shadow-xl text-text-primary">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-pill bg-brand/10 text-brand flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold font-display">Privacy Rights & Controls</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-pill p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-pill bg-surface-subtle p-1 border border-border my-4">
          <button
            onClick={() => setActiveTab("export")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-pill transition-all ${
              activeTab === "export"
                ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Export Personal Data
          </button>
          <button
            onClick={() => setActiveTab("delete")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-pill transition-all ${
              activeTab === "delete"
                ? "bg-danger/10 text-danger font-semibold shadow-xs"
                : "text-text-secondary hover:text-danger"
            }`}
          >
            Delete Account (Right to be Forgotten)
          </button>
        </div>

        {activeTab === "export" ? (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              In accordance with GDPR Article 20 and CCPA, you may export all health observations, workout logs, medical documentation, and profile metadata in machine-readable JSON.
            </p>

            <div className="rounded-2xl border border-border bg-surface-subtle p-4">
              <h4 className="text-xs font-semibold text-text-primary mb-1">
                Data Archive Contents
              </h4>
              <ul className="text-[11px] text-text-muted space-y-1 list-disc list-inside">
                <li>Biometric observations and source provenance</li>
                <li>Device registration & sync histories</li>
                <li>Logged resistance and aerobic sessions</li>
                <li>Clinical documents and physician notes</li>
              </ul>
            </div>

            {exportSuccess && (
              <div className="p-3 rounded-xl bg-positive/10 border border-positive/30 text-xs text-positive flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Archive downloaded to your local device.</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <Button variant="subtle" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExport}
                isLoading={isExporting}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Download Archive
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-xs text-danger space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Permanent Erasure Warning</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This will trigger an irrevocable cryptographic deletion cascade. All biometric records across all profiles will be purged.
              </p>
            </div>

            <Input
              label="Confirm Account Password"
              type="password"
              placeholder="••••••••••••"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />

            {deleteError && (
              <p className="text-xs text-danger font-medium">{deleteError}</p>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <Button variant="subtle" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="submit"
                isLoading={isDeleting}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Permanently Delete Account
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
