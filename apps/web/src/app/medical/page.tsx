"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  ShieldCheck,
  Calendar,
  Building2,
  AlertCircle,
  X,
} from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { api, MedicalRecordDTO } from "../../lib/api";

export default function MedicalPage() {
  const [records, setRecords] = useState<MedicalRecordDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New record form state
  const [title, setTitle] = useState("");
  const [recordType, setRecordType] = useState("lab_result");
  const [providerName, setProviderName] = useState("");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const loadRecords = async () => {
    try {
      setErrorMsg(null);
      const res = await api.medical.listRecords();
      if (res?.records) {
        setRecords(res.records);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to retrieve medical records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.medical.createRecord({
        title,
        record_type: recordType,
        provider_name: providerName || undefined,
        record_date: recordDate,
        clinical_notes: notes || undefined,
      });

      // Reset form & reload
      setTitle("");
      setProviderName("");
      setNotes("");
      setIsModalOpen(false);
      await loadRecords();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create medical record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Medical & Clinical Documentation"
      subtitle="Encrypted laboratory panels, clinical summaries, and physician reports"
      onRefreshData={loadRecords}
    >
      <div className="space-y-6">
        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
          <div>
            <h3 className="text-sm font-semibold text-text-primary font-display">
              Personal Health Records ({records.length})
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Client-side view of physician summaries, lab panels, and diagnostic tests.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Clinical Record
          </Button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-2xl bg-danger/10 border border-danger/30 p-4 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Retrieving encrypted clinical records..." />
        ) : records.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-surface-subtle/40 p-6">
            <FileText className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              No Clinical Documents Stored
            </h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto mb-5 leading-relaxed">
              Store laboratory results, physician consultation notes, and health screenings securely.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
              Add First Record
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {records.map((r) => (
              <Card key={r.id} variant="default" className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-pill bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-text-primary font-display">
                          {r.title}
                        </h4>
                        <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">
                          {r.record_type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <Badge size="sm" variant="neutral">
                      Verified
                    </Badge>
                  </div>

                  {r.clinical_notes && (
                    <p className="text-xs text-text-secondary my-3 line-clamp-3 leading-relaxed">
                      {r.clinical_notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-text-muted">
                  {r.provider_name ? (
                    <span className="flex items-center gap-1 truncate max-w-[160px]">
                      <Building2 className="h-3 w-3" />
                      {r.provider_name}
                    </span>
                  ) : (
                    <span>Self-reported</span>
                  )}
                  <span className="flex items-center gap-1 tabular-nums">
                    <Calendar className="h-3 w-3" />
                    {r.record_date}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Clinical Scope Notice */}
        <div className="p-4 rounded-2xl bg-surface-subtle/50 border border-border/60 text-xs text-text-muted flex items-start gap-2.5 leading-relaxed">
          <ShieldCheck className="h-4 w-4 text-brand shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text-secondary">Zero-Fabrication Scope: </span>
            VitalSense provides personal storage and analytics of clinical data. It does not replace medical consultation, diagnose pathology, or issue therapeutic prescriptions.
          </div>
        </div>
      </div>

      {/* Add Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-6 text-text-primary shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-base font-semibold font-display">Add Clinical Record</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-pill text-text-muted hover:text-text-primary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-4 pt-4">
              <Input
                label="Document Title"
                placeholder="e.g. Annual Comprehensive Metabolic Panel"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Record Category
                  </label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="w-full h-[44px] px-3.5 rounded-pill bg-surface-subtle text-text-primary text-xs border border-border focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="lab_result">Lab Results / Pathology</option>
                    <option value="physician_summary">Physician Summary</option>
                    <option value="vaccination">Immunization / Vaccine</option>
                    <option value="prescription">Prescription / Medication</option>
                    <option value="diagnostic_imaging">Imaging / Radiology</option>
                  </select>
                </div>

                <Input
                  label="Record Date"
                  type="date"
                  required
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </div>

              <Input
                label="Provider / Facility Name"
                placeholder="e.g. Mayo Clinic Laboratory Services"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
              />

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Clinical Summary & Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Key findings, reference ranges, or physician remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-surface-subtle text-text-primary text-xs border border-border focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-text-muted"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="subtle" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Save Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

