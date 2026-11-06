import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border bg-surface-subtle/40 ${className}`}
    >
      <div className="h-12 w-12 rounded-pill bg-surface-elevated border border-border flex items-center justify-center text-text-muted mb-4 shadow-sm">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-text-primary mb-1 font-display">
        {title}
      </h4>
      <p className="text-xs text-text-secondary max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

