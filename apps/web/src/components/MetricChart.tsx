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
      <div className="flex h-56 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
        <p className="text-sm text-slate-500">
          Insufficient historical observations to plot trends. Log at least two entries to activate charting.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span className="text-slate-300 font-medium">Recorded Observations</span>
          </div>
          {chartData.histAvgLine && (
            <div className="flex items-center space-x-1.5">
              <span className="h-0.5 w-4 bg-emerald-400 border-t border-dashed border-emerald-400" />
              <span className="text-slate-400">7-Day Rolling Avg</span>
            </div>
          )}
          {forecastData.length > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 font-medium">95% Uncertainty Projection</span>
            </div>
          )}
        </div>
        <span className="text-slate-500 uppercase tracking-wider font-semibold">Unit: {unit}</span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padding.top + (height - padding.top - padding.bottom) * pct;
            const val = chartData.yMax - pct * (chartData.yMax - chartData.yMin);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {val.toFixed(val >= 100 ? 0 : 1)}
                </text>
              </g>
            );
          })}

          {/* Baseline horizontal line */}
          {chartData.baselineY !== undefined && (
            <line
              x1={padding.left}
              y1={chartData.baselineY}
              x2={width - padding.right}
              y2={chartData.baselineY}
              stroke="#0EA5E9"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Forecast confidence interval shading */}
          {chartData.confidencePath && (
            <path d={chartData.confidencePath} fill="#F59E0B" fillOpacity="0.12" />
          )}

          {/* 7-day rolling average line */}
          {chartData.histAvgLine && (
            <path
              d={chartData.histAvgLine}
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* Historical observation line */}
          <path
            d={chartData.histLine}
            fill="none"
            stroke="#6366F1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Forecast line */}
          {chartData.fcastPoints.length > 0 && (
            <path
              d={chartData.fcastLine}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
          )}

          {/* Historical points */}
          {chartData.histPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#6366F1"
              stroke="#0F172A"
              strokeWidth="2"
              className="hover:r-6 cursor-pointer transition-all"
            >
              <title>{`${p.date}: ${p.value} ${unit}`}</title>
            </circle>
          ))}

          {/* Forecast points */}
          {chartData.fcastPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#F59E0B"
              stroke="#0F172A"
              strokeWidth="2"
              className="hover:r-6 cursor-pointer transition-all"
            >
              <title>{`${p.date} (Proj): ${p.value.toFixed(1)} [${p.lowerVal.toFixed(1)} - ${p.upperVal.toFixed(1)}]`}</title>
            </circle>
          ))}

          {/* X Axis dates */}
          {chartData.histPoints.map((p, i) => {
            // Render every 2nd or 3rd date to prevent overlap
            if (i % Math.ceil(chartData.histPoints.length / 5) !== 0 && i !== chartData.histPoints.length - 1) {
              return null;
            }
            return (
              <text
                key={i}
                x={p.x}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fill="#64748B"
                fontSize="10"
              >
                {p.date.slice(5)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

