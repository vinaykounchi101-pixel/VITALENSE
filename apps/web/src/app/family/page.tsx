"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ShieldAlert,
  Heart,
  Activity,
  Moon,
  Info,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { api, PersonProfile } from "../../lib/api";
import { motion } from "framer-motion";

export default function FamilyPage() {
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [relationshipType, setRelationshipType] = useState("child");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadProfiles = async () => {
    try {
      setErrorMsg(null);
      const res = await api.family.listProfiles();
      if (res?.profiles) {
        setProfiles(res.profiles);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load profiles.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.family.createProfile({
        display_name: displayName.trim(),
        relationship_type: relationshipType,
      });
      setDisplayName("");
      setIsAddOpen(false);
      await loadProfiles();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not create dependent profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Family & Dependent Health"
      subtitle="Visual reference preview and managed member profiles"
      onRefreshData={loadProfiles}
    >
      <div className="space-y-6">
        {/* Phase Gate Advisory Notice */}
        <div className="p-4 rounded-2xl bg-brand-soft/30 dark:bg-brand/10 border border-brand/20 flex items-start gap-3 text-xs text-text-secondary">
          <Info className="h-4 w-4 text-brand shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-text-primary">
              Visual Reference & Product Phase Gate
            </span>
            <p className="leading-relaxed">
              Family telemetry sharing shown here is an approved UI visual reference. In accordance with the VitalSense architecture, cross-device multi-member live telemetry remains subject to Phase 2 end-to-end cryptographic consent and audit protocols. Currently displayed profiles are stored securely in your primary tenant database.
            </p>
          </div>
        </div>

        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand" />
            <span className="text-sm font-semibold text-text-primary font-display">
              Registered Profiles ({profiles.length})
            </span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Add Dependent / Member
          </Button>
        </div>

        {/* Add Profile Drawer / Form */}
        {isAddOpen && (
          <Card variant="default" className="border-brand/40 shadow-sm animate-fade-in">
            <CardHeader>
              <div>
                <CardTitle>Add Dependent or Family Member</CardTitle>
                <CardDescription>
                  Create an encrypted health profile linked to your primary account
                </CardDescription>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateProfile} className="space-y-4 pt-1">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger">
                  {errorMsg}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Display Name or Pseudonym"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Leo or Emma"
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Relationship Type
                  </label>
                  <select
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-subtle border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="child">Child / Dependent</option>
                    <option value="spouse">Spouse / Partner</option>
                    <option value="parent">Parent</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                >
                  Save Profile
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Profile Grid */}
        {isLoading ? (
          <LoadingState message="Loading family member profiles..." />
        ) : profiles.length === 0 ? (
          <div className="p-8 text-center rounded-3xl border border-dashed border-border bg-surface-subtle/40">
            <Users className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              No Secondary Profiles Configured
            </h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
              Add children, dependents, or partners to manage distinct pediatric baselines and multi-person health metrics.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              leftIcon={<UserPlus className="h-4 w-4 text-brand" />}
            >
              Add First Member
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profiles.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="p-5 rounded-3xl border border-border bg-surface hover:border-brand/40 transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-pill bg-mint-soft text-brand font-bold flex items-center justify-center font-display text-base">
                        {p.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary font-display">
                          {p.display_name}
                        </h4>
                        <span className="text-xs text-text-muted capitalize">
                          {p.relationship_type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <Badge variant={p.relationship_type === "self" ? "brand" : "neutral"} size="sm">
                      {p.relationship_type === "self" ? "Primary" : "Member"}
                    </Badge>
                  </div>

                  {/* Telemetry Status Strip */}
                  <div className="p-3 rounded-2xl bg-surface-subtle/80 border border-border/60 space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Heart className="h-3 w-3 text-coral" /> Heart Rate
                      </span>
                      <span className="font-semibold text-text-primary tabular-nums">
                        {p.relationship_type === "self" ? "Telemetry Active" : "Pair Device"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Moon className="h-3 w-3 text-lavender" /> Sleep Baseline
                      </span>
                      <span className="font-semibold text-text-primary tabular-nums">
                        {p.relationship_type === "self" ? "Active" : "Pending Data"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-positive" /> Profile Linked
                  </span>
                  <span>ID: {p.id.slice(0, 8)}...</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

