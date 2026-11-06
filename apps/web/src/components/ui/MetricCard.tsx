"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "./Badge";
import { motion } from "framer-motion";

export interface MetricCardProps {
  title: string;
  metricKey: string;
  value: number | null | undefined;
  unit: string;
  changePct?: number | null;
  status?: string;
  icon: React.ReactNode;
  variant?: "coral" | "mint" | "lavender" | "blue" | "peach";
  isSelected?: boolean;
  onClick?: () => void;
  rollingAvg?: number | null;
}

export function MetricCard({
  title,
  value,
  unit,
  changePct,
  status,
  icon,
  variant = "mint",
  isSelected = false,
  onClick,
  rollingAvg,
}: MetricCardProps) {
  const iconContainerStyles = {
    coral: "bg-coral-soft text-coral",
    mint: "bg-mint-soft text-brand",
    lavender: "bg-lavender-soft text-lavender",
    blue: "bg-blue-soft text-blue",
    peach: "bg-peach-soft text-peach",
  };

  const hasData = value !== null && value !== undefined && !isNaN(value);

  return (
    <motion.div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      whileHover={onClick ? { y: -3, transition: { duration: 0.2 } } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative p-5 rounded-2xl border transition-colors duration-200 select-none ${
        onClick ? "cursor-pointer" : ""
      } ${
        isSelected
          ? "bg-surface-elevated border-brand ring-2 ring-brand/20 shadow-md"
          : "bg-surface border-border hover:border-brand/40 shadow-xs"
      }`}
    >
      {/* Top row: Icon tile & Status */}
      <div className="flex items-center justify-between mb-3">
        <div
          className={`h-11 w-11 rounded-pill flex items-center justify-center transition-colors ${iconContainerStyles[variant]}`}
        >
          {icon}
        </div>
        {status && (
          <Badge
            size="sm"
            variant={
              status.toLowerCase() === "optimal" || status.toLowerCase() === "good"
                ? "positive"
                : status.toLowerCase() === "elevated" || status.toLowerCase() === "attention"
                ? "warning"
                : "neutral"
            }
          >
            {status}
          </Badge>
        )}
      </div>

      {/* Metric Title */}
      <p className="text-xs font-medium text-text-secondary mb-1">{title}</p>

      {/* Value & Unit */}
      <div className="flex items-baseline gap-1.5 mb-2">
        {hasData ? (
          <>
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary tabular-nums font-display">
              {Number.isInteger(value) ? value : value.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-text-muted">{unit}</span>
          </>
        ) : (
          <span className="text-sm font-medium text-text-muted italic py-1">
            No data recorded
          </span>
        )}
      </div>

      {/* Comparison & rolling average footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
        {changePct !== undefined && changePct !== null ? (
          <div className="flex items-center gap-1 font-medium">
            {changePct > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-positive" />
            ) : changePct < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-coral" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-text-muted" />
            )}
            <span
              className={
                changePct > 0
                  ? "text-positive"
                  : changePct < 0
                  ? "text-coral"
                  : "text-text-muted"
              }
            >
              {changePct > 0 ? `+${changePct.toFixed(1)}%` : `${changePct.toFixed(1)}%`}
            </span>
            <span className="text-text-muted font-normal">vs 7d avg</span>
          </div>
        ) : (
          <span className="text-text-muted text-[11px]">Baseline pending</span>
        )}

        {rollingAvg !== undefined && rollingAvg !== null && (
          <span className="text-[11px] text-text-muted tabular-nums">
            Avg: {Number.isInteger(rollingAvg) ? rollingAvg : rollingAvg.toFixed(1)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
