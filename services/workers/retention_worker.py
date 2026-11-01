"""Operational Background Retention Worker.

Implements OD-07, OD-14, and DATA-007:
- Prunes raw external payload records older than retention window (default: 30 days)
  while preserving lineage metadata in source_records.
- Purges expired synchronization tombstones older than retention window (default: 30 days)
  to bound database growth.
- Executable via CLI for cron/scheduled jobs:
    python -m services.workers.retention_worker --retention-days 30
- Executable as an async background task within application lifecycle.
- Emits structured observable audit logs for all pruning operations.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Dict, Optional

from vitalsense_common.config import settings
from vitalsense_common.database import (
    close_database_connections,
    get_session_factory,
)
from vitalsense_common.logging import logger, setup_logging
from services.sync.service import SyncService


async def run_retention_prune_job(
    retention_days: Optional[int] = None,
) -> Dict[str, int]:
    """Execute a single retention pruning pass over raw payloads and tombstones.

    Returns a dictionary of execution metrics:
        {"raw_payloads_pruned": int, "tombstones_pruned": int}
    """
    days = (
        retention_days
        if retention_days is not None
        else settings.RAW_PAYLOAD_RETENTION_DAYS
    )
    logger.info(
        "Starting operational retention pruning job",
        extra={"retention_days": days},
    )

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            # 1. Prune expired raw payloads (OD-07)
            raw_pruned = await SyncService.prune_expired_raw_payloads(
                session=session, retention_days=days
            )

            # 2. Prune expired tombstones (OD-07, OD-14)
            tombstones_pruned = await SyncService.prune_expired_tombstones(
                session=session, retention_days=days
            )

            await session.commit()

            metrics = {
                "raw_payloads_pruned": raw_pruned,
                "tombstones_pruned": tombstones_pruned,
                "retention_days": days,
            }
            logger.info(
                "Retention pruning job completed successfully",
                extra=metrics,
            )
            return metrics
        except Exception as exc:
            await session.rollback()
            logger.error(
                "Retention pruning job failed; transaction rolled back",
                exc_info=exc,
            )
            raise


async def retention_worker_loop(
    interval_hours: Optional[int] = None,
    retention_days: Optional[int] = None,
) -> None:
    """Continuously execute retention pruning at specified hourly intervals."""
    interval = (
        interval_hours
        if interval_hours is not None
        else settings.RETENTION_RUN_INTERVAL_HOURS
    )
    days = (
        retention_days
        if retention_days is not None
        else settings.RAW_PAYLOAD_RETENTION_DAYS
    )
    sleep_seconds = interval * 3600

    logger.info(
        "Retention background worker started",
        extra={"interval_hours": interval, "retention_days": days},
    )

    try:
        while True:
            try:
                await run_retention_prune_job(retention_days=days)
            except Exception as exc:
                logger.error(
                    "Error during scheduled retention worker pass",
                    exc_info=exc,
                )

            logger.info(
                f"Retention worker sleeping for {interval} hours ({sleep_seconds} seconds)"
            )
            await asyncio.sleep(sleep_seconds)
    except asyncio.CancelledError:
        logger.info("Retention worker loop received cancellation request, shutting down.")
        raise


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for standalone execution."""
    parser = argparse.ArgumentParser(
        description="VitalSense Operational Retention Pruning Runner (OD-07, OD-14)"
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=settings.RAW_PAYLOAD_RETENTION_DAYS,
        help="Age threshold in days beyond which raw payloads and tombstones are pruned (default: 30)",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Run continuously in a loop using RETENTION_RUN_INTERVAL_HOURS instead of a single one-off pass",
    )
    return parser.parse_args()


async def _async_main() -> int:
    args = parse_args()
    setup_logging(
        level=settings.LOG_LEVEL,
        structured=settings.ENABLE_STRUCTURED_LOGGING,
    )
    try:
        if args.loop:
            await retention_worker_loop(retention_days=args.retention_days)
        else:
            await run_retention_prune_job(retention_days=args.retention_days)
        return 0
    except Exception as exc:
        logger.critical("Fatal error in retention worker CLI execution", exc_info=exc)
        return 1
    finally:
        await close_database_connections()


def main() -> None:
    """CLI Entrypoint."""
    exit_code = asyncio.run(_async_main())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
