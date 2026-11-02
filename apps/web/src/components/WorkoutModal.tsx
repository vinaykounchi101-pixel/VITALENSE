"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Dumbbell } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
}

export function WorkoutModal({ isOpen, onClose, onSuccess, onSaved }: Props) {
  const [workoutType, setWorkoutType] = useState("Strength Training");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [targetMuscles, setTargetMuscles] = useState<string[]>(["chest", "triceps"]);
  const [exercises, setExercises] = useState([
    {
      exercise_name: "Barbell Bench Press",
      target_muscle: "chest",
      sets: [
        { set_number: 1, reps: 10, weight_kg: 60 },
        { set_number: 2, reps: 8, weight_kg: 70 },
      ],
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function addExercise() {
    setExercises([
      ...exercises,
      {
        exercise_name: "Dumbbell Curl",
        target_muscle: "biceps",
        sets: [{ set_number: 1, reps: 10, weight_kg: 14 }],
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-semibold">Log Workout Session</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300">Workout Type</label>
              <input
                type="text"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300">Duration (Minutes)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Exercises & Sets</label>
              <button
                type="button"
                onClick={addExercise}
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
              >
                <Plus className="h-3 w-3" /> Add Exercise
              </button>
            </div>

            <div className="space-y-3">
              {exercises.map((ex, idx) => (
                <div key={idx} className="rounded-lg border border-slate-800 bg-slate-800/50 p-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={ex.exercise_name}
                      onChange={(e) => {
                        const updated = [...exercises];
                        updated[idx].exercise_name = e.target.value;
                        setExercises(updated);
                      }}
                      className="bg-transparent font-medium text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeExercise(idx)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {ex.sets.map((s) => `${s.reps} reps @ ${s.weight_kg}kg`).join(" | ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Log Workout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WorkoutModal;
