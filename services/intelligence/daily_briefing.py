"""VitalSense Daily Health Intelligence Briefing Service.

Generates personalized daily summaries and health highlights using:
1. Google Gemini API (when configured with GEMINI_API_KEY).
2. Deterministic offline heuristics (when offline or unconfigured).

Enforces mandatory non-diagnostic disclaimers and zero-hallucination policies.
"""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.analytics.service import AnalyticsService
from vitalsense_common.config import settings
from vitalsense_common.logging import logger
from vitalsense_common.models.base import utc_now
from vitalsense_common.models.extended import DailyInsight
from vitalsense_common.schemas.intelligence import (
    MANDATORY_MEDICAL_DISCLAIMER,
    DailyBriefingResponse,
)


class DailyBriefingService:
    """Service for producing daily health intelligence summaries."""

    @classmethod
    async def get_or_generate_briefing(
        cls,
        session: AsyncSession,
        person_id: uuid.UUID,
        target_date: Optional[date] = None,
    ) -> DailyBriefingResponse:
        """Fetch cached daily insight or generate a new briefing grounded in real metrics."""
        today = target_date or utc_now().date()

        # Check cache in daily_insights
        cached_query = select(DailyInsight).where(
            DailyInsight.person_id == person_id,
            DailyInsight.insight_date == today,
        )
        cached_res = await session.execute(cached_query)
        cached_insight = cached_res.scalar_one_or_none()
        if cached_insight:
            return DailyBriefingResponse(
                person_id=cached_insight.person_id,
                insight_date=cached_insight.insight_date,
                headline=cached_insight.headline,
                summary_text=cached_insight.summary_text,
                recovery_score=float(cached_insight.recovery_score) if cached_insight.recovery_score is not None else None,
                key_metrics=cached_insight.key_metrics or {},
                recommendations=cached_insight.recommendations or [],
                provider=cached_insight.provider,
                disclaimer=cached_insight.disclaimer,
                generated_at=cached_insight.created_at,
            )

        # Retrieve real analytics summary
        dashboard = await AnalyticsService.get_dashboard_summary(session, person_id)

        # Generate briefing
        briefing = await cls._generate_briefing(dashboard, today)

        # Persist to daily_insights
        insight_record = DailyInsight(
            person_id=person_id,
            insight_date=today,
            headline=briefing.headline,
            summary_text=briefing.summary_text,
            recovery_score=briefing.recovery_score,
            key_metrics=briefing.key_metrics,
            recommendations=briefing.recommendations,
            disclaimer=MANDATORY_MEDICAL_DISCLAIMER,
            provider=briefing.provider,
        )
        session.add(insight_record)
        await session.flush()

        return briefing

    @classmethod
    async def _generate_briefing(
        cls,
        dashboard: Any,
        today: date,
    ) -> DailyBriefingResponse:
        """Execute Gemini API if key is present; otherwise execute deterministic offline heuristics."""
        gemini_api_key = getattr(settings, "GEMINI_API_KEY", None)

        if gemini_api_key:
            try:
                return await cls._call_gemini_api(dashboard, today, gemini_api_key)
            except Exception as exc:
                logger.warning(
                    "Gemini API generation failed, falling back to deterministic heuristics",
                    extra={"error": str(exc)},
                )

        return cls._generate_deterministic_fallback(dashboard, today)

    @staticmethod
    def _generate_deterministic_fallback(
        dashboard: Any,
        today: date,
    ) -> DailyBriefingResponse:
        """Deterministic, data-grounded heuristic health briefing."""
        now = utc_now()
        steps = dashboard.metrics.get("steps")
        sleep = dashboard.metrics.get("sleep_session")
        hr = dashboard.metrics.get("resting_heart_rate")
        bp_sys = dashboard.metrics.get("blood_pressure_systolic")
        bp_dia = dashboard.metrics.get("blood_pressure_diastolic")

        headline_parts = []
        recommendations = []
        key_metrics_summary: Dict[str, Any] = {}

        if steps and steps.latest_value is not None:
            key_metrics_summary["steps"] = steps.latest_value
            if steps.latest_value >= 10000:
                headline_parts.append("High Activity Day")
                recommendations.append("Excellent step count today. Ensure adequate hydration and mineral replenishment.")
            elif steps.latest_value < 4000:
                recommendations.append("Activity is currently below your baseline. Consider a gentle 20-minute evening walk.")

        if sleep and sleep.latest_value is not None:
            sleep_hrs = round(sleep.latest_value / 3600.0, 1)
            key_metrics_summary["sleep_hours"] = sleep_hrs
            if sleep_hrs >= 7.0:
                headline_parts.append("Optimal Sleep Duration")
            else:
                recommendations.append("Sleep duration was under 7 hours. Aim for a consistent wind-down routine tonight.")

        if hr and hr.latest_value is not None:
            key_metrics_summary["resting_hr"] = hr.latest_value
            if hr.latest_value <= 65:
                headline_parts.append("Favorable Resting Heart Rate")

        if bp_sys and bp_sys.latest_value is not None and bp_dia and bp_dia.latest_value is not None:
            key_metrics_summary["blood_pressure"] = f"{int(bp_sys.latest_value)}/{int(bp_dia.latest_value)} mmHg"
            if bp_sys.latest_value >= 130 or bp_dia.latest_value >= 85:
                recommendations.append("Blood pressure shows mild elevation compared to baseline. Focus on stress management and low-sodium nutrition.")

        if not headline_parts:
            headline = "Daily Health & Wellness Overview"
            summary = "Log your daily metrics to build personalized baseline trends and recovery estimates."
            if not recommendations:
                recommendations.append("Synchronize your wearable or log your measurements to activate continuous intelligence.")
        else:
            headline = " • ".join(headline_parts)
            summary = (
                f"On {today.strftime('%B %d, %Y')}, your recovery score is estimated at "
                f"{dashboard.recovery_score or 'N/A'}/100 based on your recorded sleep, activity, and resting biomarkers."
            )

        return DailyBriefingResponse(
            person_id=dashboard.person_id,
            insight_date=today,
            headline=headline,
            summary_text=summary,
            recovery_score=dashboard.recovery_score,
            key_metrics=key_metrics_summary,
            recommendations=recommendations,
            provider="deterministic_heuristic",
            disclaimer=MANDATORY_MEDICAL_DISCLAIMER,
            generated_at=now,
        )

    @staticmethod
    async def _call_gemini_api(
        dashboard: Any,
        today: date,
        api_key: str,
    ) -> DailyBriefingResponse:
        """Call Gemini API using google-genai SDK for structured briefing generation."""
        import httpx

        now = utc_now()
        prompt = (
            f"You are the VitalSense Health Intelligence Assistant. Analyze the following health metrics for {today.isoformat()}:\n"
            f"{json.dumps({k: m.model_dump(mode='json') for k, m in dashboard.metrics.items() if m.latest_value is not None}, default=str)}\n\n"
            f"Generate a JSON object with keys: headline (string), summary_text (string), recommendations (list of strings). "
            f"Ground all statements strictly in the supplied data. Do NOT diagnose or provide clinical prescription. "
            f"Include mandatory disclaimer: '{MANDATORY_MEDICAL_DISCLAIMER}'."
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            # Clean markdown JSON block if present
            cleaned = raw_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())

            return DailyBriefingResponse(
                person_id=dashboard.person_id,
                insight_date=today,
                headline=parsed.get("headline", "Daily Health Intelligence Briefing"),
                summary_text=parsed.get("summary_text", "Daily biomarkers summary."),
                recovery_score=dashboard.recovery_score,
                key_metrics={k: m.latest_value for k, m in dashboard.metrics.items() if m.latest_value is not None},
                recommendations=parsed.get("recommendations", []),
                provider="gemini-1.5-flash",
                disclaimer=MANDATORY_MEDICAL_DISCLAIMER,
                generated_at=now,
            )
