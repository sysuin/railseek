"""Unofficial 'IRCTC' API on RapidAPI (host irctc1.p.rapidapi.com).

Not affiliated with IRCTC. Request shapes follow public community wrappers;
response parsing is deliberately tolerant because field names are not
officially documented. Use `railseek probe ...` to see a raw response.

If RAILRADAR_KEY is set, train schedules come from RailRadar instead
(documented API, free tier), which saves RapidAPI requests.
"""

from __future__ import annotations

from datetime import date, datetime

from ..models import Avail, Stop, TrainHit
from ..status import parse_status
from . import TTL_AVAIL, TTL_SCHEDULE, TTL_TRAINS, HttpProvider, ProviderError

BASE = "https://irctc1.p.rapidapi.com"
HOST = "irctc1.p.rapidapi.com"
RAILRADAR = "https://api.railradar.in/v1"


def _first(d: dict, *names, default=None):
    for n in names:
        if n in d and d[n] not in (None, ""):
            return d[n]
    return default


def _hhmm_to_min(value) -> int | None:
    try:
        h, m = str(value).split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def _to_date(value) -> date | None:
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d-%b-%Y", "%d %b %Y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


class Irctc1Provider(HttpProvider):
    name = "irctc1"

    def __init__(self, key, cache, max_requests, railradar_key: str = ""):
        super().__init__(cache, max_requests)
        self._headers = {"X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST}
        self._railradar_key = railradar_key

    # raw calls, also used by `probe`
    def raw_trains(self, frm, to, on: date):
        return self._get(
            f"{BASE}/api/v3/trainBetweenStations",
            {"fromStationCode": frm, "toStationCode": to, "dateOfJourney": on.isoformat()},
            self._headers,
            TTL_TRAINS,
        )

    def raw_schedule(self, train_no):
        if self._railradar_key:
            return self._get(
                f"{RAILRADAR}/trains/{train_no}",
                {"haltsOnly": "true"},
                {"Authorization": f"Bearer {self._railradar_key}"},
                TTL_SCHEDULE,
            )
        return self._get(f"{BASE}/api/v1/getTrainSchedule", {"trainNo": train_no}, self._headers, TTL_SCHEDULE)

    def raw_availability(self, train_no, frm, to, on: date, cls, quota):
        return self._get(
            f"{BASE}/api/v2/checkSeatAvailability",  # v1 answered "Something went wrong" on 17 Nov 2026
            {
                "classType": cls,
                "fromStationCode": frm,
                "quota": quota,
                "toStationCode": to,
                "trainNo": train_no,
                "date": on.isoformat(),
            },
            self._headers,
            TTL_AVAIL,
        )

    # parsed calls
    def trains_between(self, frm, to, on: date) -> list[TrainHit]:
        data, _, _ = self.raw_trains(frm, to, on)
        rows = data.get("data") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            return []
        hits = []
        for r in rows:
            number = str(_first(r, "train_number", "trainNumber", "train_no", default="")).strip()
            if not number:
                continue
            hits.append(
                TrainHit(
                    number=number,
                    name=str(_first(r, "train_name", "trainName", default="")),
                    # the source may answer with a neighbouring station of the same city
                    board=str(_first(r, "from", "from_station_code", default=frm)).upper(),
                    alight=str(_first(r, "to", "to_station_code", default=to)).upper(),
                    classes=[str(c).upper() for c in (_first(r, "class_type", "classes", default=[]) or [])],
                    depart=str(_first(r, "from_std", "departure", default="")),
                    arrive=str(_first(r, "to_sta", "arrival", default="")),
                    duration=str(_first(r, "duration", default="")),
                )
            )
        return hits

    def schedule(self, train_no) -> list[Stop]:
        data, _, _ = self.raw_schedule(train_no)
        body = data.get("data") if isinstance(data, dict) else None
        route = body.get("route") if isinstance(body, dict) else None
        if not isinstance(route, list):
            raise ProviderError(f"no route in schedule response for {train_no}")
        stops = []
        for r in route:
            station = r.get("station") if isinstance(r.get("station"), dict) else {}
            if r.get("stop") is False or r.get("isHalt") is False:
                continue
            code = str(_first(r, "station_code", "stationCode", default=station.get("code", ""))).upper()
            if not code:
                continue
            dep_min = _first(r, "std_min")
            if dep_min is None:
                dep_min = _hhmm_to_min(_first(r, "departure", "arrival"))
            stops.append(
                Stop(
                    code=code,
                    name=str(_first(r, "station_name", "stationName", default=station.get("name", code))),
                    seq=len(stops),
                    day=int(_first(r, "day", "departureDay", "arrivalDay", default=1) or 1),
                    dep_min=int(dep_min) % 1440 if dep_min is not None else None,
                    distance_km=_first(r, "distance_from_source", "distance"),
                )
            )
        if len(stops) < 2:
            raise ProviderError(f"schedule for {train_no} has fewer than two stops")
        # some sources number days from 0
        if min(s.day for s in stops) == 0:
            for s in stops:
                s.day += 1
        return stops

    def availability(self, train_no, frm, to, on: date, cls, quota) -> Avail:
        data, fetched_at, cached = self.raw_availability(train_no, frm, to, on, cls, quota)
        rows = data.get("data") if isinstance(data, dict) else None
        fare = None
        if isinstance(rows, dict) and isinstance(rows.get("availabilityClassList"), list):
            # v2 shape: data.availabilityClassList[].availabilities[] plus a charges block
            block = next(
                (b for b in rows["availabilityClassList"] if str(b.get("reservationClass", "")).upper() == cls),
                None,
            ) or (rows["availabilityClassList"][0] if rows["availabilityClassList"] else {})
            fare = (block.get("charges") or {}).get("totalFare")
            rows = block.get("availabilities") or []
        elif isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list) or not rows:
            msg = data.get("message") if isinstance(data, dict) else ""
            avail = parse_status(str(msg or ""))
            avail.raw = str(msg or "no data returned")
        else:
            row = next((r for r in rows if _to_date(_first(r, "date", default="")) == on), None)
            if row is None:
                # never show another day's status as if it were the requested day
                dated = any(_to_date(_first(r, "date", default="")) for r in rows)
                row = {} if dated else rows[0]
            raw = str(_first(row, "current_status", "status", "availability", default=""))
            avail = parse_status(raw)
            if not row:
                avail.raw = "requested date not in response"
            prob = _first(row, "confirm_probability_percent", "confirm_probability")
            try:
                avail.probability = float(str(prob).rstrip("%")) if prob is not None else None
            except ValueError:
                avail.probability = None
            if avail.probability is None and isinstance(row.get("prediction"), (int, float)):
                avail.probability = round(row["prediction"] * 100, 1)  # v2 gives a 0-1 fraction
            fare = _first(row, "total_fare", "ticket_fare", "fare", default=fare)
            try:
                avail.fare = float(fare) if fare is not None else None
            except (TypeError, ValueError):
                avail.fare = None
        avail.fetched_at = fetched_at
        avail.from_cache = cached
        return avail
