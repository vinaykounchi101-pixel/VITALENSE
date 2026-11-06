"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, X, FileText, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  onSuccess?: () => void;
}

export function ImportModal({ isOpen, onClose, onImportComplete, onSuccess }: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState<string>("auto");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    success: boolean;
    format?: string;
    records_parsed?: number;
    records_ingested?: number;
    duplicates_suppressed?: number;
    error?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (sourceName !== "auto") {
        formData.append("source_name", sourceName);
      }

      const res = await api.integrations.uploadFile(formData);
      setResult({
        success: true,
        format: res.platform,
        records_parsed: res.total_records,
        records_ingested: res.imported_records,
        duplicates_suppressed: res.rejected_records,
      });
      (onImportComplete || onSuccess)?.();
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || "Failed to process import file.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setResult(null);
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-6 shadow-xl text-text-primary">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-pill bg-brand/10 text-brand flex items-center justify-center">
              <UploadCloud className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold font-display">Import External Health Data</h2>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="rounded-pill p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Import historical health archives. Supported formats: Apple Health export (
            <code className="text-brand font-semibold">export.xml</code> / <code className="text-brand font-semibold">export.zip</code>), Google Takeout JSON, and CSV records.
          </p>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Source Format / Provider
            </label>
            <select
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-pill border border-border bg-surface-subtle text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="auto">Auto-Detect from File Contents</option>
              <option value="apple_health">Apple Health (export.xml / zip)</option>
              <option value="google_takeout">Google Takeout (JSON)</option>
              <option value="csv">Standard Health CSV</option>
            </select>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-brand/60 rounded-2xl p-6 text-center cursor-pointer bg-surface-subtle/50 transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xml,.zip,.json,.csv"
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-text-primary">
                <FileText className="h-5 w-5 text-brand" />
                <span className="text-xs font-medium">{selectedFile.name}</span>
                <span className="text-[11px] text-text-muted">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <UploadCloud className="h-8 w-8 text-text-muted mx-auto mb-1" />
                <p className="text-xs font-medium text-text-primary">
                  Click to select or drag and drop export file
                </p>
                <p className="text-[11px] text-text-muted">
                  XML, ZIP, JSON, or CSV (up to 50MB)
                </p>
              </div>
            )}
          </div>

          {result && (
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                result.success
                  ? "bg-positive/10 border-positive/30 text-positive"
                  : "bg-danger/10 border-danger/30 text-danger"
              }`}
            >
              {result.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Import Completed Successfully</span>
                  </div>
                  <p className="text-[11px] opacity-90">
                    Parsed: {result.records_parsed} | Ingested: {result.records_ingested} | Duplicate / Suppressed: {result.duplicates_suppressed}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{result.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                resetState();
                onClose();
              }}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              isLoading={isUploading}
            >
              Start Ingestion
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
