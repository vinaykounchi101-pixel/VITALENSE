"use client";

import React, { useState, useEffect } from "react";
import { User, Shield, Calendar, Mail, Key, LogOut, Plus, CheckCircle2 } from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { LoadingState } from "../../components/ui/LoadingState";
import { api, UserProfileDTO, PersonProfile } from "../../lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfileDTO | null>(null);
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New profile form
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [relationshipType, setRelationshipType] = useState("dependent");

  const loadProfile = async () => {
    try {
      const [uRes, pRes] = await Promise.allSettled([
        api.auth.me(),
        api.family.listProfiles(),
      ]);
      if (uRes.status === "fulfilled") setUser(uRes.value);
      if (pRes.status === "fulfilled" && pRes.value?.profiles) {
        setProfiles(pRes.value.profiles);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) return;
    try {
      await api.family.createProfile({
        display_name: displayName,
        relationship_type: relationshipType,
      });
      setDisplayName("");
      setIsAddingProfile(false);
      await loadProfile();
    } catch {}
  };

  const handleSignOut = async () => {
    try {
      await api.auth.logout();
    } catch {}
    window.location.href = "/auth";
  };

  return (
    <AppShell
      title="User Account & Biometric Identity"
      subtitle="Identity authorization, account credentials, and managed health profiles"
      onRefreshData={loadProfile}
    >
      <div className="space-y-6 max-w-4xl">
        {isLoading ? (
          <LoadingState message="Loading account details..." />
        ) : (
          <>
            {/* Account Information Card */}
            <Card variant="default">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-pill bg-brand text-white flex items-center justify-center font-display font-bold text-lg shadow-sm">
                    {user?.display_name
                      ? user.display_name.charAt(0).toUpperCase()
                      : user?.email
                      ? user.email.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  <div>
                    <CardTitle>{user?.display_name || "VitalSense Account"}</CardTitle>
                    <CardDescription>{user?.email}</CardDescription>
                  </div>
                </div>
                <Badge variant="mint" size="sm">
                  Active Member
                </Badge>
              </CardHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/60">
                <div className="p-3.5 rounded-2xl bg-surface-subtle/60 border border-border">
                  <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" /> Account ID
                  </span>
                  <p className="text-xs font-mono font-medium text-text-primary mt-1 truncate">
                    {user?.user_account_id || user?.id || "—"}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-subtle/60 border border-border">
                  <span className="text-[11px] font-medium text-text-muted flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Member Since
                  </span>
                  <p className="text-xs font-medium text-text-primary mt-1">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString([], {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Recently registered"}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  Session secured with HttpOnly secure double-submit cookies.
                </span>
                <Button variant="danger" size="sm" onClick={handleSignOut} leftIcon={<LogOut className="h-3.5 w-3.5" />}>
                  Sign Out
                </Button>
              </div>
            </Card>

            {/* Managed Health Profiles (Family / Dependents) */}
            <Card variant="default">
              <CardHeader>
                <div>
                  <CardTitle>Managed Health Profiles</CardTitle>
                  <CardDescription>
                    Individual health records segmented under this account
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAddingProfile(!isAddingProfile)}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  {isAddingProfile ? "Cancel" : "Add Profile"}
                </Button>
              </CardHeader>

              {isAddingProfile && (
                <form
                  onSubmit={handleCreateProfile}
                  className="p-4 mb-4 rounded-2xl bg-surface-subtle border border-border space-y-3"
                >
                  <Input
                    label="Profile Display Name"
                    placeholder="e.g. Eleanor Vance"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Relationship Type
                    </label>
                    <select
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      className="w-full h-[44px] px-3.5 rounded-pill bg-surface-elevated text-text-primary text-xs border border-border focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="self">Self</option>
                      <option value="spouse">Spouse / Partner</option>
                      <option value="dependent">Dependent / Child</option>
                      <option value="elder">Elder / Parent</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="subtle" size="sm" onClick={() => setIsAddingProfile(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      Save Profile
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5 pt-1">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-surface-subtle/60 border border-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-pill bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                        {p.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">
                          {p.display_name}
                        </p>
                        <p className="text-[10px] text-text-muted capitalize">
                          {p.relationship_type}
                        </p>
                      </div>
                    </div>

                    {p.is_primary ? (
                      <Badge variant="mint" size="sm">
                        Primary Account
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Managed
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

