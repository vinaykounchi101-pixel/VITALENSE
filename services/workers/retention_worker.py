"""Operational Background Retention Worker.

Implements OD-07, OD-14, and DATA-007:
- Prunes raw external payload records older than retention window (default: 30 days)
  while strictly preserving provenance and lineage metadata in source_records.
- Purges expired synchronization tombstones older than retention window (default: 30 days)
  to bound database growth and maintain predictable storage overhead.
- Emits structured observable audit logs for all pruning passes.

PRODUCTION DEPLOYMENT ARCHITECTURE & SAFETY:
---------------------------------------------
1. Recommended Production Architecture (Decoupled Single-Runner):
   - In production environments, run this worker as a standalone, scheduled cron job
     or Kubernetes CronJob:
         python -m services.workers.retention_worker --retention-days 30
   - Schedule once daily (e.g. at 03:00 UTC during off-peak load).
   - This ensures exactly one worker process executes the maintenance queries,
     eliminating lock contention and duplicate work across API servers.

2. Application Lifespan Worker Caution (Multi-Process Scaling):
   - The FastAPI lifespan worker (ENABLE_RETENTION_WORKER=true in settings) is
     provided strictly for single-process local development, testing, and simple
     single-container deployments.
   - If enabled in a multi-process or multi-replica environment (e.g. multiple Uvicorn
     workers via '-w 4' or multi-pod horizontal scaling behind a reverse proxy),
     EACH worker process will instantiate its own retention loop, resulting in
     redundant, overlapping scheduled executions. Keep ENABLE_RETENTION_WORKER=false
     in multi-worker API pods.

3. Idempotency & Transaction Safety:
   - Queries are fully idempotent:
       UPDATE source_records SET raw_payload = NULL WHERE ingestion_timestamp < cutoff AND raw_payload IS NOT NULL
       DELETE FROM sync_tombstones WHERE deleted_at < cutoff
   - Even if concurrent executions occur, each runs in an isolated transaction.
     Rollback protection ensures failure does not leave uncommitted partial state.
   - All source_records rows remain in the database; only raw_payload JSON is cleared.
     Idempotency keys, source record IDs, and timestamps are permanently retained.
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
