import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "positive"
    | "warning"
    | "danger"
    | "neutral"
    | "coral"
    | "mint"
    | "lavender"
    | "blue"
    | "peach"
    | "brand";
  size?: "sm" | "md";
}

export function Badge({
  children,
  className = "",
  variant = "neutral",
  size = "md",
  ...props
}: BadgeProps) {
  const variantStyles = {
    positive: "bg-positive/15 text-positive border-positive/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    neutral: "bg-surface-subtle text-text-secondary border-border",
    coral: "bg-coral-soft text-coral border-coral/30",
    mint: "bg-mint-soft text-brand border-mint/40",
    lavender: "bg-lavender-soft text-lavender border-lavender/30",
    blue: "bg-blue-soft text-blue border-blue/30",
    peach: "bg-peach-soft text-peach border-peach/30",
    brand: "bg-brand/10 text-brand border-brand/20",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-pill border select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

