"""In-Memory Rate Limiter for Authentication and Sensitive Endpoints.

Implements SEC-002, SEC-008:
- Sliding-window rate limiting per endpoint and client IP
- Defends login, registration, and password-reset endpoints against brute-force attacks
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter."""

    def __init__(self) -> None:
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(
        self,
        key: str,
        max_requests: int = 10,
        window_seconds: int = 60,
    ) -> bool:
        """Check if the given key has exceeded the maximum number of requests in the window.

        Returns True if rate limited, False otherwise.
        """
        now = time.monotonic()
        cutoff = now - window_seconds
        # Evict timestamps older than the window
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= max_requests:
            return True

        self._requests[key].append(now)
        return False

    def check(
        self,
        request: Request,
        endpoint_key: str,
        max_requests: int = 10,
        window_seconds: int = 60,
    ) -> None:
        """Check rate limit for a request based on client IP and endpoint key.

        Raises HTTP 429 if the limit is exceeded.
        """
        client_ip = (
            request.headers.get("x-forwarded-for")
            or (request.client.host if request.client else "127.0.0.1")
        )
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()
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
        self._requests.clear()


auth_rate_limiter = InMemoryRateLimiter()

