"use client";

import React, { useMemo } from "react";
import { TrendDataPoint, ForecastPoint } from "../lib/api";

interface MetricChartProps {
  metricName: string;
  unit: string;
  historicalData: TrendDataPoint[];
  forecastData?: ForecastPoint[];
  baselineMean?: number;
}

export function MetricChart({
  metricName,
  unit,
  historicalData,
  forecastData = [],
  baselineMean,
}: MetricChartProps) {
  // SVG Viewbox dimensions
  const width = 650;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 55 };

  const chartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return null;

    // Collect all values to calculate Y min/max
    const allValues: number[] = [];
    historicalData.forEach((d) => {
      allValues.push(d.value);
      if (d.rolling_avg !== undefined) allValues.push(d.rolling_avg);
    });

    forecastData.forEach((f) => {
      allValues.push(f.predicted_value);
      allValues.push(f.lower_bound);
      allValues.push(f.upper_bound);
    });

    if (baselineMean !== undefined) {
      allValues.push(baselineMean);
    }

    if (allValues.length === 0) return null;

    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const buffer = (rawMax - rawMin) * 0.1 || (rawMax * 0.1) || 5;
    const yMin = Math.max(0, rawMin - buffer);
    const yMax = rawMax + buffer;

    // Coordinate conversion
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const totalPoints = historicalData.length + forecastData.length;
    if (totalPoints <= 1) return null;

    const getX = (index: number) => padding.left + (index / (totalPoints - 1)) * plotWidth;
    const getY = (val: number) => padding.top + plotHeight - ((val - yMin) / (yMax - yMin)) * plotHeight;

    // Build historical points path
    const histPoints = historicalData.map((d, i) => ({
      x: getX(i),
      y: getY(d.value),
      date: d.bucket_time.split("T")[0],
      value: d.value,
      rollingAvg: d.rolling_avg !== undefined ? getY(d.rolling_avg) : undefined,
    }));

    // Build forecast points path (connecting from last historical point)
    const lastHistX = getX(historicalData.length - 1);
    const lastHistY = getY(historicalData[historicalData.length - 1].value);

    const fcastPoints = forecastData.map((f, i) => {
      const idx = historicalData.length + i;
      return {
        x: getX(idx),
        y: getY(f.predicted_value),
        lowerY: getY(f.lower_bound),
        upperY: getY(f.upper_bound),
        date: f.date,
        value: f.predicted_value,
        lowerVal: f.lower_bound,
        upperVal: f.upper_bound,
      };
    });

    // Forecast confidence area polygon
    let confidencePath = "";
    if (fcastPoints.length > 0) {
      const upperPath = [`M ${lastHistX} ${lastHistY}`, ...fcastPoints.map((p) => `L ${p.x} ${p.upperY}`)].join(" ");
      const lowerPath = fcastPoints
        .slice()
        .reverse()
        .map((p) => `L ${p.x} ${p.lowerY}`)
        .join(" ");
      confidencePath = `${upperPath} ${lowerPath} Z`;
    }

    const histLine = histPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const histAvgLine = histPoints
      .filter((p) => p.rollingAvg !== undefined)
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.rollingAvg}`)
      .join(" ");

    const fcastLine = [`M ${lastHistX} ${lastHistY}`, ...fcastPoints.map((p) => `L ${p.x} ${p.y}`)].join(" ");

    return {
      yMin,
      yMax,
      histPoints,
      fcastPoints,
      histLine,
      histAvgLine,
      fcastLine,
      confidencePath,
      baselineY: baselineMean !== undefined ? getY(baselineMean) : undefined,
    };
  }, [historicalData, forecastData, baselineMean]);

  if (!chartData || historicalData.length === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-2xl border border-dashed border-border bg-surface-subtle/40 p-6 text-center">
        <p className="text-xs text-text-muted">
          Insufficient historical observations to plot trends for {metricName.replace(/_/g, " ")}. Log at least two entries to activate charting.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-pill bg-brand" />
            <span className="text-text-primary font-medium">Recorded Observations</span>
          </div>
          {chartData.histAvgLine && (
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-mint border-t border-dashed border-mint" />
              <span className="text-text-secondary">7-Day Rolling Avg</span>
            </div>
          )}
          {forecastData.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-pill bg-peach" />
              <span className="text-text-primary font-medium">95% Uncertainty Projection</span>
            </div>
          )}
        </div>
        <span className="text-text-muted uppercase tracking-wider text-[11px] font-semibold">
          Unit: {unit}
        </span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
          {/* Subtle horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const yVal = chartData.yMin + pct * (chartData.yMax - chartData.yMin);
            const yPos = padding.top + (1 - pct) * (height - padding.top - padding.bottom);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={width - padding.right}
                  y2={yPos}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="text-[10px] fill-text-muted tabular-nums"
                >
                  {yVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Baseline Mean line */}
          {chartData.baselineY !== undefined && (
            <g>
              <line
                x1={padding.left}
                y1={chartData.baselineY}
                x2={width - padding.right}
                y2={chartData.baselineY}
                stroke="#69727A"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text
                x={width - padding.right}
                y={chartData.baselineY - 4}
                textAnchor="end"
                className="text-[10px] fill-text-muted"
              >
                Baseline ({baselineMean?.toFixed(1)})
              </text>
            </g>
          )}

          {/* Forecast confidence interval polygon */}
          {chartData.confidencePath && (
            <path
              d={chartData.confidencePath}
              className="fill-peach/20"
            />
          )}

          {/* Forecast predicted line */}
          {forecastData.length > 0 && (
            <path
              d={chartData.fcastLine}
              fill="none"
              stroke="#F0B58D"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          )}

          {/* 7-Day Rolling Average line */}
          {chartData.histAvgLine && (
            <path
              d={chartData.histAvgLine}
              fill="none"
              stroke="#A9C9B9"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* Historical Observations Line */}
          <path
            d={chartData.histLine}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Historical points circles */}
          {chartData.histPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3.5"
              className="fill-surface stroke-brand"
              strokeWidth="2"
            />
          ))}

          {/* Forecast point dots */}
          {chartData.fcastPoints.map((p, i) => (
            <circle
              key={`fc-${i}`}
              cx={p.x}
              cy={p.y}
              r="3"
              className="fill-surface stroke-peach"
              strokeWidth="2"
            />
          ))}

          {/* X-axis date labels */}
          {chartData.histPoints
            .filter((_, i) => i === 0 || i === Math.floor(chartData.histPoints.length / 2) || i === chartData.histPoints.length - 1)
            .map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                className="text-[10px] fill-text-muted tabular-nums"
              >
                {p.date}
              </text>
            ))}
        </svg>
      </div>
    </div>
  );
}
