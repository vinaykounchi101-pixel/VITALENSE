"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Dumbbell, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export function WorkoutModal({ isOpen, onClose, onSuccess, onSaved }: Props) {
  const [workoutType, setWorkoutType] = useState("strength_training");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [targetMuscles, setTargetMuscles] = useState<string[]>([]);
  const [exercises, setExercises] = useState<
    Array<{
      exercise_name: string;
      target_muscle: string;
      sets: Array<{ set_number: number; reps: number; weight_kg: number }>;
    }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function addExercise() {
    setExercises([
      ...exercises,
      {
        exercise_name: "",
        target_muscle: "chest",
        sets: [{ set_number: 1, reps: 10, weight_kg: 20 }],
      },
    ]);
  }

  function removeExercise(idx: number) {
    setExercises(exercises.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.fitness.logWorkout({
        workout_type: workoutType,
        duration_minutes: parseFloat(durationMinutes),
        exercises,
        muscle_groups: targetMuscles,
      });
      (onSuccess || onSaved)?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log workout session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-elevated p-6 text-text-primary shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-pill bg-blue-soft text-blue flex items-center justify-center">
              <Dumbbell className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold font-display">Log Workout Session</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-pill p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/30 p-3 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Workout Type"
              type="text"
              value={workoutType}
              onChange={(e) => setWorkoutType(e.target.value)}
              required
            />
            <Input
              label="Duration (Minutes)"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-secondary">Exercises & Sets</label>
              <button
                type="button"
                onClick={addExercise}
                className="flex items-center gap-1 text-xs text-brand hover:underline font-medium"
              >
                <Plus className="h-3 w-3" /> Add Exercise
              </button>
            </div>

            <div className="space-y-2.5">
              {exercises.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted">
                  No individual exercises added. Click &quot;+ Add Exercise&quot; to log specific movements, weights, and repetitions.
                </div>
              ) : (
                exercises.map((ex, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-surface-subtle p-3.5">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        placeholder="Exercise name (e.g. Barbell Squat)"
                        value={ex.exercise_name}
                        onChange={(e) => {
                          const updated = [...exercises];
                          updated[idx].exercise_name = e.target.value;
                          setExercises(updated);
                        }}
                        className="bg-transparent font-semibold text-xs text-text-primary focus:outline-none w-full"
                      />
                      <button
                        type="button"
                        onClick={() => removeExercise(idx)}
                        className="text-text-muted hover:text-danger p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-text-secondary">
                      {ex.sets.map((s) => `${s.reps} reps @ ${s.weight_kg}kg`).join(" | ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button variant="subtle" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={submitting}>
              Log Workout
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WorkoutModal;
