"""Data providers. Each one answers three read-only questions:

    trains_between(frm, to, on)  -> list[TrainHit]
    schedule(train_no)           -> list[Stop]
    availability(...)            -> Avail
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from ..cache import Cache


class ProviderError(Exception):
    pass


class BudgetExceeded(ProviderError):
    pass


class AccessDenied(ProviderError):
    """Key missing, subscription expired or rate limit hit. No point retrying."""


TTL_TRAINS = 24 * 3600
TTL_SCHEDULE = 7 * 24 * 3600
TTL_AVAIL = 10 * 60


class HttpProvider:
    """Shared plumbing: request budget, polite pacing, caching."""

    name = "http"
    min_interval = 1.0  # seconds between live requests

    def __init__(self, cache: Cache, max_requests: int = 100):
        self.cache = cache
        self.max_requests = max_requests
        self.calls = 0
        self._last = 0.0

    def _get(self, url: str, params: dict, headers: dict, ttl: int):
        """Return (json, fetched_at_iso, from_cache)."""
        key = f"{self.name}|{url}|{json.dumps(params, sort_keys=True)}"
        hit = self.cache.get(key, ttl)
        if hit:
            data, ts = hit
            return data, _iso(ts), True
        if self.calls >= self.max_requests:
            raise BudgetExceeded(f"request budget of {self.max_requests} used up")
        wait = self.min_interval - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        self.calls += 1
        self._last = time.time()
        req = urllib.request.Request(
            url + "?" + urllib.parse.urlencode(params),
            headers={"Accept": "application/json", "User-Agent": "railseek/0.2", **headers},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:200]
            if e.code in (401, 403, 429):
                raise AccessDenied(f"HTTP {e.code} from {self.name}: {body}") from e
            raise ProviderError(f"HTTP {e.code} from {self.name}: {body}") from e
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            raise ProviderError(f"{self.name} request failed: {e}") from e
        self.cache.put(key, data)
        return data, _iso(time.time()), False


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).astimezone().isoformat(timespec="seconds")


def make_provider(name: str, env: dict, cache: Cache, max_requests: int):
    from .demo import DemoProvider
    from .irctc1 import Irctc1Provider

    if name == "demo":
        return DemoProvider()
    if name in ("auto", "confirmtkt"):
        from .confirmtkt import ConfirmTktProvider

        return ConfirmTktProvider(cache, max_requests)
    key = env.get("RAPIDAPI_KEY", "").strip()
    if name == "irctc1":
        if not key:
            raise ProviderError("--provider irctc1 needs RAPIDAPI_KEY in a .env file (see .env.example).")
        return Irctc1Provider(key, cache, max_requests, railradar_key=env.get("RAILRADAR_KEY", "").strip())
    raise ProviderError(f"unknown provider {name!r}")
