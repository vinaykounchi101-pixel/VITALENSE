import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingState({
  message = "Loading health data...",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border bg-surface ${className}`}
    >
      <Loader2 className="h-7 w-7 animate-spin text-brand mb-3" />
      <p className="text-xs font-medium text-text-secondary">{message}</p>
    </div>
  );
}

export function SkeletonTile({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-subtle/80 rounded-2xl border border-border/60 ${className}`}
    />
  );
}

