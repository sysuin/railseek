"""Rule calendar: the moments that matter for one train and journey date.

Rules are as reported in 2025-2026 news coverage of Railway Board circulars
(see reports/). Several are not confirmed against the circulars themselves,
so every event carries a note where the basis is uncertain. All times IST.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from .models import Stop

IST = ZoneInfo("Asia/Kolkata")
AC_CLASSES = {"1A", "2A", "3A", "3E", "CC", "EC", "EA"}


@dataclass
class Event:
    when: datetime
    kind: str  # tatkal-ac | tatkal-nonac | emergency-quota | first-chart | current-closes | refund-25 | refund-50 | refund-0 | departure
    label: str
    note: str = ""


def _at(d: date, minutes: int) -> datetime:
    return datetime.combine(d, time(minutes // 60, minutes % 60), IST)


def build_timeline(stops: list[Stop], board: str, journey_date: date, classes: list[str] | None = None) -> list[Event]:
    """journey_date is the date the train leaves the boarding station."""
    b = next((s for s in stops if s.code == board), None)
    origin = stops[0]
    if b is None or b.dep_min is None or origin.dep_min is None:
        raise ValueError(f"no departure time for {board} in this train's route")
    board_dep = _at(journey_date, b.dep_min)
    origin_date = journey_date - timedelta(days=b.day - origin.day)
    origin_dep = _at(origin_date, origin.dep_min)
    classes = classes or ["3A", "SL"]
    events: list[Event] = []

    tatkal_day = origin_date - timedelta(days=1)
    basis = ""
    if origin_date != journey_date:
        alt = journey_date - timedelta(days=1)
        basis = (
            f"Counted from the day the train starts at {origin.code} ({origin_date:%d %b}), so it opens on {tatkal_day:%d %b}. "
            f"Some sources count from your boarding date, which would make it open on {alt:%d %b}. Check on IRCTC."
        )
    if any(c in AC_CLASSES for c in classes):
        events.append(Event(_at(tatkal_day, 600), "tatkal-ac", "Tatkal opens for AC classes", basis))
    if any(c not in AC_CLASSES for c in classes):
        events.append(Event(_at(tatkal_day, 660), "tatkal-nonac", "Tatkal opens for non-AC classes", basis))

    prev = origin_date - timedelta(days=1)
    morning = origin.dep_min <= 14 * 60
    events.append(
        Event(
            _at(prev, 12 * 60 if morning else 16 * 60),
            "emergency-quota",
            "Emergency quota request deadline",
            "Needs a genuine forwarding authority. Based on the train's departure from its first station.",
        )
    )

    if 5 * 60 < origin.dep_min <= 14 * 60:
        chart = _at(prev, 20 * 60)
    else:
        chart = origin_dep - timedelta(hours=10)
    events.append(
        Event(
            chart,
            "first-chart",
            "First chart due; leftover berths go on sale as current booking",
            f"Estimated from the train's departure from {origin.code}. "
            f"Stations far down the route can have their own later chart.",
        )
    )
    events.append(
        Event(
            board_dep - timedelta(minutes=30),
            "current-closes",
            "Current booking closes (about 30 minutes before departure)",
            f"Whether this runs up to departure from {board} or from an earlier station is unconfirmed.",
        )
    )
    refund_note = "Confirmed Tatkal tickets are never refundable."
    events.append(Event(board_dep - timedelta(hours=72), "refund-25", "From now, cancelling costs 25% of the fare", refund_note))
    events.append(Event(board_dep - timedelta(hours=24), "refund-50", "From now, cancelling costs 50% of the fare", refund_note))
    events.append(Event(board_dep - timedelta(hours=8), "refund-0", "From now, cancelling gives no refund", refund_note))
    events.append(Event(board_dep, "departure", f"Train leaves {board}"))
    events.sort(key=lambda e: e.when)
    return events


def relative(when: datetime, now: datetime) -> str:
    secs = int((when - now).total_seconds())
    if secs < 0:
        return "passed"
    days, rem = divmod(secs, 86400)
    hours, rem = divmod(rem, 3600)
    mins = rem // 60
    if days:
        return f"in {days}d {hours}h"
    if hours:
        return f"in {hours}h {mins}m"
    return f"in {mins}m"


def render_timeline(title: str, events: list[Event], now: datetime | None = None) -> str:
    now = now or datetime.now(IST)
    lines = [title, ""]
    nxt = next((e for e in events if e.when >= now), None)
    for e in events:
        mark = ">" if e is nxt else " "
        lines.append(f"{mark} {e.when:%a %d %b %H:%M}  {relative(e.when, now):<10}  {e.label}")
        if e.note:
            lines.append(f"{'':31}{e.note}")
    lines.append("")
    lines.append("Times are IST and come from reported 2025-26 rules, not from IRCTC. Treat them as a guide.")
    return "\n".join(lines)
