"""Alerts: re-run a search on a timer and tell the user when something opens up,
plus reminders shortly before Tatkal opens and when the first chart is due.

Read-only, like the rest of railseek. It polls the data provider, never IRCTC.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

from .engine import Option, SearchRequest, SearchResult, search
from .timeline import IST, build_timeline

RANK = {"AVAILABLE": 3, "RAC": 2, "WL": 1}
REMIND_KINDS = {"tatkal-ac": 10, "tatkal-nonac": 10, "first-chart": 0}  # minutes of warning
MIN_INTERVAL_MIN = 10  # availability is cached for 10 minutes, so faster polling learns nothing


def option_key(o: Option) -> str:
    return " + ".join(
        f"{c.train.number} {c.cls}/{c.quota} {c.book_from}-{c.book_to} {c.book_date:%d%b}" for c in o.legs
    )


def snapshot(result: SearchResult) -> dict:
    snap = {}
    for o in result.options:
        kinds = [leg.avail.kind for leg in o.legs]
        if any(k in ("ERROR", "UNKNOWN") for k in kinds):
            continue  # a failed check tells us nothing; keep whatever we knew before
        rank = min(RANK.get(k, 0) for k in kinds)
        snap[option_key(o)] = {"rank": rank, "status": " + ".join(leg.avail.raw for leg in o.legs)}
    return snap


def diff_alerts(prev: dict | None, now: dict) -> list[str]:
    """Messages worth interrupting the user for."""
    alerts = []
    for key, cur in now.items():
        old_rank = (prev or {}).get(key, {}).get("rank", 0)
        if prev is None:
            if cur["rank"] >= 2:  # first look: only shout about seats and RAC
                alerts.append(f"Bookable now: {key} is {cur['status']}")
        elif cur["rank"] > old_rank:
            was = (prev.get(key) or {}).get("status", "not seen before")
            alerts.append(f"Opened up: {key} is {cur['status']} (was {was})")
    return alerts


def due_reminders(result: SearchResult, req: SearchRequest, sent: set[str], now: datetime, window_min: int) -> list[tuple[str, str]]:
    """(id, message) for timeline events that fall inside the next polling window."""
    out = []
    for hit, primary in result.hits:
        stops = result.schedules.get(hit.number)
        if not primary or not stops:
            continue
        try:
            events = build_timeline(stops, hit.board, req.on, req.classes or hit.classes)
        except ValueError:
            continue
        for e in events:
            lead = REMIND_KINDS.get(e.kind)
            if lead is None:
                continue
            rid = f"{hit.number}|{e.kind}|{e.when.isoformat()}"
            start = e.when - timedelta(minutes=lead + window_min)
            if rid not in sent and start <= now <= e.when + timedelta(minutes=5):
                out.append((rid, f"{hit.number} {hit.name.strip()}: {e.label} at {e.when:%H:%M on %d %b}"))
    return out


def notify(message: str, title: str = "railseek") -> None:
    print(f"[{datetime.now(IST):%d %b %H:%M}] ALERT  {message}", flush=True)
    if sys.platform == "darwin":
        script = ["-e", "on run argv", "-e", "display notification (item 1 of argv) with title (item 2 of argv) sound name \"Glass\"", "-e", "end run"]
        try:
            subprocess.run(["osascript", *script, message, title], check=False, timeout=10, capture_output=True)
        except (OSError, subprocess.SubprocessError):
            pass


def state_path(root: Path, req: SearchRequest) -> Path:
    ident = json.dumps([req.origin, req.dest, req.on.isoformat(), req.also_from, req.also_to, req.classes, req.quotas, req.trains], sort_keys=True)
    return root / (hashlib.sha1(ident.encode()).hexdigest()[:12] + ".json")


def tick(provider, req: SearchRequest, path: Path, interval_min: int, now: datetime | None = None, send=notify) -> SearchResult:
    """One polling round: search, compare with last time, alert, save."""
    now = now or datetime.now(IST)
    try:
        state = json.loads(path.read_text())
    except (OSError, ValueError):
        state = {}
    result = search(provider, req)
    snap = snapshot(result)
    for msg in diff_alerts(state.get("options"), snap):
        send(msg)
    sent = set(state.get("reminders", []))
    for rid, msg in due_reminders(result, req, sent, now, interval_min):
        send(msg)
        sent.add(rid)
    merged = {**(state.get("options") or {}), **snap}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"options": merged, "reminders": sorted(sent), "checked_at": now.isoformat()}))
    return result


def run_watch(provider, req: SearchRequest, root: Path, interval_min: int, once: bool, on_result=None) -> int:
    interval_min = max(interval_min, MIN_INTERVAL_MIN)
    path = state_path(root, req)
    while True:
        result = tick(provider, req, path, interval_min)
        if on_result:
            on_result(result)
        if any("Stopped" in n for n in result.notes):
            print("Stopping the watch: the data source refused or the request budget ran out.", flush=True)
            return 1
        if once:
            return 0
        if datetime.now(IST).date() > req.on + timedelta(days=1):
            print("Journey date has passed; stopping the watch.", flush=True)
            return 0
        time.sleep(interval_min * 60)
