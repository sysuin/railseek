"""Small on-disk JSON cache so repeat searches do not spend API requests."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path


class Cache:
    def __init__(self, root: Path, enabled: bool = True):
        self.root = root
        self.enabled = enabled

    def _path(self, key: str) -> Path:
        return self.root / (hashlib.sha1(key.encode()).hexdigest() + ".json")

    def get(self, key: str, ttl_seconds: int):
        """Return (data, saved_at_epoch) or None."""
        if not self.enabled:
            return None
        path = self._path(key)
        try:
            entry = json.loads(path.read_text())
        except (OSError, ValueError):
            return None
        if time.time() - entry.get("ts", 0) > ttl_seconds:
            return None
        return entry.get("data"), entry.get("ts")

    def put(self, key: str, data) -> None:
        if not self.enabled:
            return
        self.root.mkdir(parents=True, exist_ok=True)
        self._path(key).write_text(json.dumps({"ts": time.time(), "key": key, "data": data}))
