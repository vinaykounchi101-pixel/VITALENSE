import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle";
  hasPadding?: boolean;
}

export function Card({
  children,
  className = "",
  variant = "default",
  hasPadding = true,
  ...props
}: CardProps) {
  const bgStyles = {
    default: "bg-surface border-border",
    elevated: "bg-surface-elevated border-border shadow-sm",
    subtle: "bg-surface-subtle border-border/60",
  };

  return (
    <div
      className={`rounded-2xl border transition-colors ${bgStyles[variant]} ${
        hasPadding ? "p-5 sm:p-6" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between pb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-base font-semibold text-text-primary tracking-tight font-display ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-text-secondary mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

