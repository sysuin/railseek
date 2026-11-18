"""ConfirmTkt's public train search (cttrainsapi.confirmtkt.com). No key needed.

Undocumented and unofficial: it can change or be blocked at any time. One
request for a station pair returns every train on it with availability for
all classes in general and Tatkal quota, so a whole sweep needs few requests.

The figures are ConfirmTkt's saved copies, not live lookups. Each one carries
the time it was saved, which is reported as `fetched_at`.
"""

from __future__ import annotations

from datetime import date

from ..models import Avail, Stop, TrainHit
from ..status import parse_status
from . import TTL_AVAIL, TTL_SCHEDULE, HttpProvider, ProviderError

BASE = "https://cttrainsapi.confirmtkt.com/api/v1/trains"
QUOTA_FIELD = {"GN": "availabilityCache", "TQ": "availabilityCacheTatkal"}


def _minutes(value) -> int | None:
    try:
        h, m = str(value).strip().split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def parse_entry(entry: dict, on: date) -> Avail:
    """One class's saved availability from a search response."""
    if str(entry.get("date", ""))[:10] != on.isoformat():
        avail = Avail(raw="requested date not in response", kind="UNKNOWN")
    else:
        avail = parse_status(str(entry.get("availability") or ""))
        pct = entry.get("predictionPercentage")
        if avail.kind == "WL" and isinstance(pct, (int, float)) and pct > 0:
            avail.probability = float(pct)
        try:
            fare = float(entry.get("fare") or 0)
            avail.fare = fare if fare > 0 else None
        except (TypeError, ValueError):
            avail.fare = None
    saved = str(entry.get("cacheTime") or "")[:19]
    avail.fetched_at = saved + "+05:30" if len(saved) == 19 else ""  # ConfirmTkt stamps in IST
    avail.from_cache = True
    return avail


def parse_schedule(data, train_no) -> list[Stop]:
    rows = data.get("Schedule") if isinstance(data, dict) else None
    if not isinstance(rows, list) or len(rows) < 2:
        raise ProviderError(f"no route in schedule response for {train_no}")
    stops = []
    for r in rows:
        code = str(r.get("StationCode") or "").upper()
        if not code:
            continue
        dep = _minutes(r.get("DepartureTime"))
        if dep is None:
            dep = _minutes(r.get("ArrivalTime"))
        try:
            day = int(r.get("Day") or 1)
        except (TypeError, ValueError):
            day = 1
        stops.append(Stop(code, str(r.get("StationName") or code).title(), len(stops), day, dep, r.get("Distance")))
    if len(stops) < 2:
        raise ProviderError(f"schedule for {train_no} has fewer than two stops")
    return stops


class ConfirmTktProvider(HttpProvider):
    name = "confirmtkt"

    def __init__(self, cache, max_requests):
        super().__init__(cache, max_requests)
        self._index: dict[tuple, dict] = {}  # (train, from, to, date) -> raw train row
        self._loaded: set[tuple] = set()

    # raw calls, also used by `probe`
    def raw_trains(self, frm, to, on: date):
        return self._get(
            f"{BASE}/search",
            {
                "sourceStationCode": frm,
                "destinationStationCode": to,
                "addAvailabilityCache": "true",
                "dateOfJourney": on.strftime("%d-%m-%Y"),
                "enableNearby": "true",
                "showPredictionGlobal": "true",
            },
            {},
            TTL_AVAIL,
        )

    def raw_schedule(self, train_no):
        return self._get(f"{BASE}/schedule", {"trainNo": train_no}, {}, TTL_SCHEDULE)

    def raw_availability(self, train_no, frm, to, on: date, cls, quota):
        return self.raw_trains(frm, to, on)  # availability comes with the pair's train list

    def _load(self, frm, to, on: date) -> list[dict]:
        data, _, _ = self.raw_trains(frm, to, on)
        body = data.get("data") if isinstance(data, dict) else None
        rows = (body or {}).get("trainList") or []
        self._loaded.add((frm, to, on))
        rows = [r for r in rows if isinstance(r, dict) and r.get("trainNumber")]
        for r in rows:
            key = (str(r["trainNumber"]), str(r.get("fromStnCode") or frm).upper(), str(r.get("toStnCode") or to).upper(), on)
            self._index[key] = r
        return rows

    def trains_between(self, frm, to, on: date) -> list[TrainHit]:
        hits = []
        for r in self._load(frm, to, on):
            mins = r.get("duration")
            hits.append(
                TrainHit(
                    number=str(r["trainNumber"]),
                    name=str(r.get("trainName") or "").title(),
                    board=str(r.get("fromStnCode") or frm).upper(),
                    alight=str(r.get("toStnCode") or to).upper(),
                    classes=[str(c).upper() for c in (r.get("avlClasses") or [])],
                    depart=str(r.get("departureTime") or ""),
                    arrive=str(r.get("arrivalTime") or ""),
                    duration=f"{mins // 60}:{mins % 60:02d}" if isinstance(mins, int) else "",
                )
            )
        return hits

    def schedule(self, train_no) -> list[Stop]:
        data, _, _ = self.raw_schedule(train_no)
        return parse_schedule(data, train_no)

    def availability(self, train_no, frm, to, on: date, cls, quota) -> Avail:
        field = QUOTA_FIELD.get(quota)
        if field is None:
            return Avail(raw=f"{quota} quota is not covered by this source", kind="UNKNOWN")
        key = (str(train_no), frm, to, on)
        if key not in self._index and (frm, to, on) not in self._loaded:
            self._load(frm, to, on)
        row = self._index.get(key)
        if row is None:
            return Avail(raw="not offered for this station pair", kind="NA")
        entry = (row.get(field) or {}).get(cls)
        if not isinstance(entry, dict):
            return Avail(raw="class not offered for this station pair", kind="NA")
        return parse_entry(entry, on)
