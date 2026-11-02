"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, X, FileText, Loader2 } from "lucide-react";
import { api } from "../lib/api";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
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
        format: res.format_detected,
        records_parsed: res.records_parsed,
        records_ingested: res.records_ingested,
        duplicates_suppressed: res.duplicates_suppressed,
      });
      if (onImportComplete) {
        onImportComplete();
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <UploadCloud className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Import External Health Data</h2>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-400">
            Import your complete historical health archives. Supported formats: Apple Health export (<code className="text-indigo-300">export.xml</code> or <code className="text-indigo-300">export.zip</code>), Google Takeout JSON, and CSV records.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Source Format / Provider</label>
            <select
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="cursor-pointer flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-6 hover:border-indigo-500 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.zip,.json,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center space-x-3 text-slate-200">
                <FileText className="h-8 w-8 text-indigo-400" />
                <div className="text-left">
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-slate-500 mb-2" />
                <p className="text-sm font-medium text-slate-300">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-500 mt-1">XML, ZIP, JSON, or CSV up to 100MB</p>
              </>
            )}
          </div>

          {result && (
            <div
              className={`rounded-xl p-4 text-sm ${
                result.success
                  ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                  : "bg-rose-950/40 border border-rose-800/60 text-rose-300"
              }`}
            >
              {result.success ? (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Import Completed Successfully</span>
                  </div>
                  <p className="text-xs text-emerald-400">
                    Detected: <span className="font-semibold">{result.format}</span> | Parsed:{" "}
                    <span className="font-semibold">{result.records_parsed}</span> | Ingested:{" "}
                    <span className="font-semibold">{result.records_ingested}</span> | Duplicates:{" "}
                    <span className="font-semibold">{result.duplicates_suppressed}</span>
                  </p>
                </div>
              ) : (
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{result.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => {
                resetState();
                onClose();
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/30"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Archive...</span>
                </>
              ) : (
                <span>Start Import</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

