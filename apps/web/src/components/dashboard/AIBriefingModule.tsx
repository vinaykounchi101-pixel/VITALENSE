"use client";

import React from "react";
import { Sparkles, Info, CheckCircle, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { DailyBriefing } from "../../lib/api";

export interface AIBriefingModuleProps {
  briefing: DailyBriefing | null;
  isLoading?: boolean;
}

export function AIBriefingModule({ briefing, isLoading }: AIBriefingModuleProps) {
  return (
    <Card variant="default">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-pill bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Daily Intelligence Briefing</CardTitle>
            <CardDescription>
              Algorithmic synthesis of multi-dimensional biometric telemetry
            </CardDescription>
          </div>
        </div>
        <Badge variant="mint" size="sm" className="gap-1 font-medium">
          <span>Informational</span>
        </Badge>
      </CardHeader>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-text-muted">
          Synthesizing daily health intelligence...
        </div>
      ) : !briefing ? (
        <div className="py-8 text-center rounded-2xl border border-dashed border-border bg-surface-subtle/40 p-6">
          <Sparkles className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <h4 className="text-xs font-semibold text-text-primary mb-1">
            Briefing Synthesis Pending
          </h4>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            Record regular biometric measurements (heart rate, sleep, activity) to enable algorithmic daily intelligence summaries and baseline anomaly detection.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Headline & Summary */}
          <div className="p-4 rounded-2xl bg-surface-subtle/80 border border-border">
            <h4 className="text-sm font-bold text-text-primary mb-1.5 font-display">
              {briefing.headline}
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              {briefing.summary_text}
            </p>
          </div>

          {/* Recommendations list */}
          {briefing.recommendations && briefing.recommendations.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5 font-display">
                <CheckCircle className="h-3.5 w-3.5 text-brand" />
                Algorithmic Lifestyle Recommendations
              </h5>
              <div className="space-y-1.5">
                {briefing.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-subtle/50 border border-border/60 text-xs text-text-secondary flex items-start gap-2.5 leading-relaxed"
                  >
                    <span className="h-1.5 w-1.5 rounded-pill bg-brand shrink-0 mt-1.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regulatory & Safety Disclaimer */}
          <div className="p-3 rounded-xl bg-surface-subtle/30 border border-border/50 text-[11px] text-text-muted flex items-start gap-2 leading-relaxed">
            <Info className="h-3.5 w-3.5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text-secondary">Disclaimer: </span>
              {briefing.disclaimer ||
                "This briefing is algorithmically generated for general wellness intelligence and does not substitute for professional medical advice, clinical diagnosis, or medical treatment."}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

