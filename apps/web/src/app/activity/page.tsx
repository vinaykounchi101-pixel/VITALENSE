"use client";

import React, { useState, useEffect } from "react";
import { Dumbbell, PlusCircle, Flame, Clock, Award, Activity } from "lucide-react";
import { AppShell } from "../../components/navigation/AppShell";
import { Card, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { LoadingState } from "../../components/ui/LoadingState";
import { WorkoutModal } from "../../components/WorkoutModal";
import { api, WorkoutDTO, DashboardSummary } from "../../lib/api";

export default function ActivityPage() {
  const [workouts, setWorkouts] = useState<WorkoutDTO[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [wRes, sRes] = await Promise.allSettled([
        api.fitness.listWorkouts(),
        api.analytics.getDashboardSummary(),
      ]);
      if (wRes.status === "fulfilled" && wRes.value?.workouts) {
        setWorkouts(wRes.value.workouts);
      }
      if (sRes.status === "fulfilled") {
        setSummary(sRes.value);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const steps = summary?.metrics?.["steps"]?.latest_value;
  const energy = summary?.metrics?.["active_energy"]?.latest_value;

  return (
    <AppShell
      title="Activity & Workouts"
      subtitle="Training logs, muscular volume loads, and active energy expenditure"
      onRefreshData={loadData}
    >
      <div className="space-y-6">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="default" className="p-5">
            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-mint" /> Daily Steps
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2 tabular-nums font-display">
              {steps ? Math.round(steps).toLocaleString() : "—"}
              <span className="text-xs font-normal text-text-muted ml-1">steps</span>
            </p>
          </Card>

          <Card variant="default" className="p-5">
            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-peach" /> Active Burn
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2 tabular-nums font-display">
              {energy ? Math.round(energy).toLocaleString() : "—"}
              <span className="text-xs font-normal text-text-muted ml-1">kcal</span>
            </p>
          </Card>

          <Card variant="default" className="p-5">
            <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-blue" /> Logged Workouts
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2 tabular-nums font-display">
              {workouts.length}
              <span className="text-xs font-normal text-text-muted ml-1">sessions</span>
            </p>
          </Card>
        </div>

        {/* Workout Log Feed */}
        <Card variant="default">
          <CardHeader>
            <div>
              <CardTitle>Session History</CardTitle>
              <CardDescription>
                Chronological record of resistance, aerobic, and mobility sessions
              </CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<PlusCircle className="h-4 w-4" />}
            >
              Log Workout
            </Button>
          </CardHeader>

          {isLoading ? (
            <LoadingState message="Retrieving workout records..." />
          ) : workouts.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-surface-subtle/40 p-6">
              <Dumbbell className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-text-primary mb-1">
                No Workouts Recorded Yet
              </h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto mb-5 leading-relaxed">
                Log physical exercises, target muscles, and resistance sets to calculate total tonnage and monitor muscular recovery.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
                Record First Workout
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {workouts.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-2xl bg-surface-subtle/60 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-pill bg-blue-soft text-blue flex items-center justify-center shrink-0">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary capitalize font-display">
                        {w.workout_type.replace(/_/g, " ")}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {w.duration_minutes} minutes
                        </span>
                        {w.total_volume_kg && w.total_volume_kg > 0 && (
                          <span className="flex items-center gap-1">
                            <Award className="h-3.5 w-3.5 text-peach" />
                            {Math.round(w.total_volume_kg)} kg total volume
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {w.muscle_groups && w.muscle_groups.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        {w.muscle_groups.map((mg) => (
                          <Badge key={mg} size="sm" variant="neutral" className="capitalize">
                            {mg}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-text-muted tabular-nums ml-2">
                      {new Date(w.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <WorkoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </AppShell>
  );
}

