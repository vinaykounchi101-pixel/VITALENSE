"""In-Memory Rate Limiter for Authentication and Sensitive Endpoints.

Implements SEC-002, SEC-008:
- Sliding-window rate limiting per endpoint and client IP.
- Defends login, registration, and password-reset endpoints against brute-force attacks.
- Robust IP resolution: ignores spoofed X-Forwarded-For headers from untrusted proxies.
- Bounded memory footprint with automatic eviction to prevent Denial of Service (DoS).
- Thread-safe tracking guarded by reentrant synchronization locks.

Architecture Note (Horizontal Scaling):
This in-memory implementation is process-local and zero-dependency, suitable for
single-instance modular monolith deployments, local development, and test suites.
In horizontally scaled multi-instance production deployments behind a reverse proxy
or load balancer, a centralized distributed store (e.g., Redis using atomic sliding
window or token bucket algorithms) must be utilized to enforce unified rate limits
across all application nodes.
"""

from __future__ import annotations

import threading
import time
from typing import Dict, List

from fastapi import HTTPException, Request, status

from vitalsense_common.config import settings


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter with bounded memory and proxy verification."""

    def __init__(self, max_tracked_keys: int = 10000) -> None:
        self.max_tracked_keys: int = max_tracked_keys
        self._requests: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def resolve_client_ip(self, request: Request) -> str:
        """Resolve authoritative client IP address.

        Protects against header spoofing (SEC-002):
        Only trusts X-Forwarded-For if the direct peer IP is in settings.TRUSTED_PROXIES.
        Otherwise, strictly falls back to the direct socket peer IP (request.client.host).
        """
        peer_ip = (
            request.client.host
            if request.client and request.client.host
            else "127.0.0.1"
        )

        if peer_ip in settings.TRUSTED_PROXIES:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                parts = [p.strip() for p in forwarded.split(",") if p.strip()]
                if parts:
                    return parts[0]

        return peer_ip

    def _evict_expired(self, cutoff: float) -> None:
        """Internal helper to prune empty or fully expired key records."""
        expired_keys = [
            k
            for k, timestamps in self._requests.items()
            if not timestamps or timestamps[-1] <= cutoff
        ]
        for k in expired_keys:
            del self._requests[k]

    def is_rate_limited(
        self,
        key: str,
        max_requests: int = 10,
        window_seconds: int = 60,
    ) -> bool:
        """Check if the given key has exceeded the maximum number of requests in the window.

        Thread-safe and bounded to prevent memory exhaustion.
        Returns True if rate limited, False otherwise.
        """
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            # 1. Clean timestamps for requested key
            if key in self._requests:
                active = [t for t in self._requests[key] if t > cutoff]
                if active:
                    self._requests[key] = active
                else:
                    del self._requests[key]

            # 2. Prevent unbounded growth across all keys
            if len(self._requests) >= self.max_tracked_keys:
                self._evict_expired(cutoff)

            # If still exceeding capacity after pruning expired, pop oldest entries
            while (
                len(self._requests) >= self.max_tracked_keys
                and key not in self._requests
            ):
                oldest_key = next(iter(self._requests))
                del self._requests[oldest_key]

            current_count = len(self._requests.get(key, []))
            if current_count >= max_requests:
                return True

            if key not in self._requests:
                self._requests[key] = []
            self._requests[key].append(now)
            return False

    def check(
        self,
        request: Request,
        endpoint_key: str,
        max_requests: int = 10,
        window_seconds: int = 60,
    ) -> None:
        """Check rate limit for a request based on verified client IP and endpoint key.

        Raises HTTP 429 if the limit is exceeded.
        """
        client_ip = self.resolve_client_ip(request)
        composite_key = f"{endpoint_key}:{client_ip}"

        if self.is_rate_limited(
            composite_key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
            )

    def reset(self) -> None:
        """Clear all rate limit tracking data (for test isolation)."""
        with self._lock:
            self._requests.clear()


auth_rate_limiter = InMemoryRateLimiter()
