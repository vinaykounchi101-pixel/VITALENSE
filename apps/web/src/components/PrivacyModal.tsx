"use client";

import React, { useState } from "react";
import { ShieldCheck, Download, Trash2, AlertTriangle, X, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../lib/api";

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

    if (!confirm("Are you ABSOLUTELY sure? This will permanently delete your account, credentials, and all health records across all profiles. This action CANNOT be undone.")) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Privacy, Data Portability & Rights</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mt-4">
          <button
            onClick={() => setActiveTab("export")}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "export"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export Data (GDPR Art. 20)</span>
          </button>
          <button
            onClick={() => setActiveTab("delete")}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "delete"
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            <span>Right to Erasure (Art. 17)</span>
          </button>
        </div>

        <div className="mt-4">
          {activeTab === "export" ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400 leading-relaxed">
                VitalSense adheres strictly to privacy-by-design. You can download a complete, machine-readable JSON archive containing all your profiles, health observations, workout logs, medical records, and synchronization audit trails.
              </p>

              {exportSuccess && (
                <div className="flex items-center space-x-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 p-4 text-sm text-emerald-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Personal health archive generated and downloaded successfully.</span>
                </div>
              )}

              <div className="rounded-xl bg-slate-800/50 p-4 border border-slate-700/50">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Archive Contents</h4>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li>Profile & family metadata</li>
                  <li>Time-series health observations & metrics</li>
                  <li>Workouts, sets, reps, and exercise volume</li>
                  <li>Medical conditions and clinical lab records</li>
                  <li>Sync history and source device identifiers</li>
                </ul>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center space-x-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/30"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating Archive...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Download JSON Export</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleDelete} className="space-y-4">
              <div className="rounded-xl bg-rose-950/30 border border-rose-900/60 p-4 text-sm text-rose-300 flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Irreversible Account & Data Erasure</p>
                  <p className="text-xs text-rose-400 leading-relaxed">
                    Executing erasure cascades permanently across all PostgreSQL tables. All credentials, active sessions, health records, medical labs, and backup references will be purged immediately.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your password to verify authorization"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {deleteError && (
                <div className="rounded-lg bg-rose-950/40 border border-rose-800/60 p-3 text-xs text-rose-300">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deletePassword || isDeleting}
                  className="flex items-center space-x-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-lg shadow-rose-600/30"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Purging All Data...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Permanently Erase Everything</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
