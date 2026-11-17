"""Made-up data for trying the tool without an API key.

Train numbers, timings and availability here are INVENTED. They only mimic
the shape of a busy corridor: the user's own station pair is closed while
other pairs on the same train still have seats.
"""

from __future__ import annotations

from datetime import date, datetime

from ..models import Avail, Stop, TrainHit

# (code, name, day, "HH:MM")
_ROUTES = {
    "90001": (
        "Demo Coastal Express",
        ["SL", "3A", "2A", "1A"],
        [
            ("PURI", "Puri", 1, "21:45"),
            ("BBS", "Bhubaneswar", 1, "23:00"),
            ("TATA", "Tatanagar", 2, "06:30"),
            ("GAYA", "Gaya Jn", 2, "13:10"),
            ("SSM", "Sasaram", 2, "14:58"),
            ("DDU", "Pt DD Upadhyaya Jn", 2, "16:50"),
            ("PRYJ", "Prayagraj Jn", 2, "19:05"),
            ("CNB", "Kanpur Central", 2, "21:20"),
            ("NDLS", "New Delhi", 3, "04:50"),
        ],
    ),
    "90002": (
        "Demo Bodhi Express",
        ["SL", "3E", "3A", "2A", "1A"],
        [
            ("GAYA", "Gaya Jn", 1, "14:00"),
            ("SSM", "Sasaram", 1, "15:28"),
            ("DDU", "Pt DD Upadhyaya Jn", 1, "17:15"),
            ("PRYJ", "Prayagraj Jn", 1, "19:30"),
            ("CNB", "Kanpur Central", 1, "21:50"),
            ("NDLS", "New Delhi", 2, "04:10"),
        ],
    ),
    "90003": (
        "Demo Eastern Mail",
        ["SL", "3A", "2A"],
        [
            ("HWH", "Howrah Jn", 1, "21:55"),
            ("DHN", "Dhanbad Jn", 2, "02:10"),
            ("GAYA", "Gaya Jn", 2, "05:05"),
            ("SSM", "Sasaram", 2, "06:29"),
            ("DDU", "Pt DD Upadhyaya Jn", 2, "08:20"),
            ("CNB", "Kanpur Central", 2, "13:40"),
            ("DLI", "Delhi Jn", 2, "20:30"),
            ("KLK", "Kalka", 3, "03:00"),
        ],
    ),
}


def _status(train, frm_idx, to_idx, n_stops, cls) -> tuple[str, float | None]:
    from_origin = frm_idx == 0
    if cls == "1A":
        return ("GNWL4/WL3" if from_origin else "PQWL5/WL4"), 45.0
    if train == "90001":
        if from_origin:
            return ("AVAILABLE-0006" if cls == "2A" else "GNWL18/WL9"), 78.0
        return "REGRET", None
    if train == "90002":
        if from_origin:
            return ("AVAILABLE-0014" if cls in ("3A", "3E") else "RAC 12"), 90.0
        return ("PQWL44/WL31" if cls == "SL" else "REGRET"), 12.0
    # 90003
    if frm_idx <= 1:
        return "GNWL22/WL11", 70.0
    if to_idx == n_stops - 1 and frm_idx >= 3:
        return "RLWL9/WL6", 40.0
    return ("RLWL30/WL24" if cls == "SL" else "REGRET"), 8.0


class DemoProvider:
    name = "demo"
    calls = 0

    def trains_between(self, frm, to, on: date) -> list[TrainHit]:
        hits = []
        for number, (name, classes, route) in _ROUTES.items():
            codes = [s[0] for s in route]
            if frm in codes and to in codes and codes.index(frm) < codes.index(to):
                a, b = route[codes.index(frm)], route[codes.index(to)]
                hits.append(TrainHit(number, name, frm, to, list(classes), a[3], b[3]))
        return hits

    def schedule(self, train_no) -> list[Stop]:
        route = _ROUTES[train_no][2]
        return [
            Stop(code, name, i, day, int(t[:2]) * 60 + int(t[3:]))
            for i, (code, name, day, t) in enumerate(route)
        ]

    def availability(self, train_no, frm, to, on: date, cls, quota) -> Avail:
        from ..status import parse_status

        self.calls += 1
        codes = [s[0] for s in _ROUTES[train_no][2]]
        raw, prob = _status(train_no, codes.index(frm), codes.index(to), len(codes), cls)
        if quota == "TQ":
            raw, prob = "TQWL6/WL6", 20.0
        avail = parse_status(raw)
        avail.probability = prob if avail.kind == "WL" else None
        avail.fare = 400.0 + 1.1 * 100 * (codes.index(to) - codes.index(frm)) * {"SL": 1, "3E": 2.4, "3A": 2.6, "2A": 3.7, "1A": 6.2}.get(cls, 1)
        avail.fetched_at = datetime.now().astimezone().isoformat(timespec="seconds")
        return avail
