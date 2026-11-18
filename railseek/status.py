"""Turn availability strings such as 'GNWL23/WL12' into structured data and a score."""

from __future__ import annotations

import re

from .models import Avail

_WL = re.compile(r"\b([A-Z]{0,2}WL)\s*(\d+)(?:\s*/\s*[A-Z]*WL\s*(\d+))?")
_RAC = re.compile(r"RAC\s*(\d+)(?:\s*/\s*RAC\s*(\d+))?")
_AVL = re.compile(r"(?:AVAILABLE|AVBL|AVL)\D{0,3}(\d+)")


def parse_status(raw: str) -> Avail:
    text = (raw or "").upper().strip()
    if not text:
        return Avail(raw=raw or "", kind="UNKNOWN")
    if "REGRET" in text:
        return Avail(raw=raw, kind="REGRET")
    if "DEPARTED" in text:
        return Avail(raw=raw, kind="DEPARTED")
    if "NOT AVAILABLE" in text or "NOT EXIST" in text or "SUSPENDED" in text:
        return Avail(raw=raw, kind="NA")
    m = _AVL.search(text)
    if m:
        return Avail(raw=raw, kind="AVAILABLE", count=int(m.group(1)))
    m = _RAC.search(text)
    if m:
        return Avail(raw=raw, kind="RAC", count=int(m.group(2) or m.group(1)))
    m = _WL.search(text)
    if m:
        running = int(m.group(2))
        current = int(m.group(3)) if m.group(3) else running
        wl_type = m.group(1) if m.group(1) != "WL" else ""
        return Avail(raw=raw, kind="WL", count=current, wl_type=wl_type, wl_running=running)
    if "AVAILABLE" in text or "AVBL" in text:
        return Avail(raw=raw, kind="AVAILABLE")
    return Avail(raw=raw, kind="UNKNOWN")


def score(avail: Avail | None, tier: int = 0) -> float:
    """Higher is better. Simpler bookings (lower tier) win ties."""
    if avail is None:
        return -1.0
    penalty = tier * 5
    if avail.kind == "AVAILABLE":
        return 1000 + min(avail.count or 1, 50) - penalty
    if avail.kind == "RAC":
        return 800 - min(avail.count or 0, 100) - penalty
    if avail.kind == "WL":
        pos = avail.count or 0
        if avail.probability is not None:
            return 400 + avail.probability - penalty  # the source's estimate already reflects the waitlist type
        bonus = {"GNWL": 20, "TQWL": -20}.get(avail.wl_type, 0)
        return 400 + max(0.0, 100 - 3 * pos) + bonus - penalty
    if avail.kind in ("REGRET", "NA", "DEPARTED"):
        return 0.0
    return -1.0


def is_bookable(avail: Avail | None) -> bool:
    return avail is not None and avail.kind in ("AVAILABLE", "RAC", "WL")
