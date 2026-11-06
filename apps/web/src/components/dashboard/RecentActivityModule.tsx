"use client";

import React from "react";
import { Dumbbell, PlusCircle, Flame, Clock, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { WorkoutDTO } from "../../lib/api";

export interface RecentActivityModuleProps {
  workouts: WorkoutDTO[];
  onLogWorkout?: () => void;
  isLoading?: boolean;
}

export function RecentActivityModule({
  workouts,
  onLogWorkout,
  isLoading,
}: RecentActivityModuleProps) {
  return (
    <Card variant="default">
      <CardHeader>
        <div>
          <CardTitle>Physical Activity & Workouts</CardTitle>
          <CardDescription>
            Session logs, volume loads, and targeted muscle activation
          </CardDescription>
        </div>
        {onLogWorkout && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onLogWorkout}
            leftIcon={<PlusCircle className="h-3.5 w-3.5 text-brand" />}
          >
            Log Workout
          </Button>
        )}
      </CardHeader>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-text-muted">Loading activity logs...</div>
      ) : workouts.length === 0 ? (
        <div className="py-8 text-center rounded-2xl border border-dashed border-border bg-surface-subtle/40 p-6">
          <Dumbbell className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <h4 className="text-xs font-semibold text-text-primary mb-1">
            No Workout Sessions Recorded
          </h4>
          <p className="text-xs text-text-muted max-w-xs mx-auto mb-4">
            Log resistance training, cardio, or athletic routines to track load volume and recovery impact.
          </p>
          {onLogWorkout && (
            <Button variant="secondary" size="sm" onClick={onLogWorkout}>
              Log First Workout
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {workouts.slice(0, 4).map((w) => (
            <div
              key={w.id}
              className="p-3.5 rounded-2xl bg-surface-subtle/60 border border-border/70 flex items-center justify-between gap-3 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-pill bg-blue-soft text-blue flex items-center justify-center shrink-0">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-text-primary capitalize font-display">
                    {w.workout_type.replace(/_/g, " ")}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {w.duration_minutes} min
                    </span>
                    {w.total_volume_kg && w.total_volume_kg > 0 && (
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3 text-peach" />
                        {Math.round(w.total_volume_kg)} kg load
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {w.muscle_groups && w.muscle_groups.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    {w.muscle_groups.slice(0, 2).map((mg) => (
                      <Badge key={mg} size="sm" variant="neutral" className="capitalize text-[10px]">
                        {mg}
                      </Badge>
                    ))}
                  </div>
                )}
                <span className="text-[11px] text-text-muted tabular-nums">
                  {new Date(w.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

