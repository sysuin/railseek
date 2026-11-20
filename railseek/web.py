"""Local web UI. Serves one page and a small JSON API on 127.0.0.1 only.

Read-only like the rest of railseek: it searches and explains, it does not
log in to IRCTC or book. The API key stays on the server side.
"""

from __future__ import annotations

import json
import re
import threading
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .cache import Cache
from .engine import ALL_CLASSES, Option, SearchRequest, SearchResult, search
from .handoff import sheet_data
from .providers import ProviderError, make_provider
from .timeline import IST, build_timeline, relative
from .watch import MIN_INTERVAL_MIN, RANK, option_key, state_path, tick

STATIC = Path(__file__).resolve().parent / "static"
CODE = re.compile(r"^[A-Z]{1,6}$")
TRAIN = re.compile(r"^[0-9A-Z]{3,6}$")
_search_lock = threading.Lock()  # one search at a time keeps the pacing honest


class BadRequest(Exception):
    pass


def _codes(value, pattern=CODE, limit=8) -> list[str]:
    if isinstance(value, str):
        value = re.split(r"[,\s]+", value)
    out = []
    for v in value or []:
        v = str(v).strip().upper()
        if not v:
            continue
        if not pattern.match(v):
            raise BadRequest(f"'{v}' does not look like a valid code")
        out.append(v)
    return out[:limit]


def _int(body, key, default, lo, hi) -> int:
    try:
        return max(lo, min(hi, int(body.get(key, default))))
    except (TypeError, ValueError):
        return default


def parse_request(body: dict) -> SearchRequest:
    origin, dest = _codes(body.get("origin")), _codes(body.get("dest"))
    if len(origin) != 1 or len(dest) != 1:
        raise BadRequest("Enter one From station code and one To station code, for example SSM and NDLS.")
    try:
        on = date.fromisoformat(str(body.get("date", "")))
    except ValueError:
        raise BadRequest("Pick a journey date.") from None
    today = datetime.now(IST).date()
    if on < today or on > today + timedelta(days=62):
        raise BadRequest("The journey date must be between today and about 60 days from now.")
    classes = [c for c in _codes(body.get("classes"), re.compile(r"^[0-9A-Z]{2}$")) if c in ALL_CLASSES]
    quotas = _codes(body.get("quotas"), re.compile(r"^[A-Z]{2}$"), 3) or ["GN"]
    return SearchRequest(
        origin=origin[0],
        dest=dest[0],
        on=on,
        also_from=_codes(body.get("also_from")),
        also_to=_codes(body.get("also_to")),
        classes=classes,
        quotas=quotas,
        trains=_codes(body.get("trains"), TRAIN, 12),
        upstream=_int(body, "upstream", 3, 0, 6),
        downstream=_int(body, "downstream", 1, 0, 3),
        splits=_int(body, "splits", 0, 0, 3),
    )


def _how(o: Option, req: SearchRequest) -> str:
    from .cli import how

    return how(o, req)


def _level(o: Option) -> str:
    rank = min(RANK.get(leg.avail.kind, 0) for leg in o.legs)
    return {3: "available", 2: "rac", 1: "waitlist"}.get(rank, "closed")


def serialize(result: SearchResult, req: SearchRequest, provider, now: datetime | None = None) -> dict:
    now = now or datetime.now(IST)
    options = []
    for o in result.options:
        c = o.legs[0]
        probs = [l.avail.probability for l in o.legs if l.avail.kind == "WL" and l.avail.probability is not None]
        fares = [l.avail.fare for l in o.legs]
        options.append(
            {
                "id": option_key(o),
                "level": _level(o),
                "kind": o.kind,
                "train": c.train.number,
                "train_name": c.train.name.strip(),
                "depart": c.train.depart,
                "arrive": c.train.arrive,
                "duration": c.train.duration,
                "cls": c.cls,
                "quota": c.quota,
                "book_from": c.book_from,
                "book_to": o.legs[-1].book_to,
                "book_date": c.book_date.isoformat(),
                "board": c.board,
                "alight": c.alight,
                "status": " + ".join(l.avail.raw or l.avail.kind for l in o.legs),
                "chance": min(probs) if probs else None,
                "fare": sum(fares) if all(f is not None for f in fares) else None,
                "how": _how(o, req),
                "sheets": [sheet_data(l, result.schedules.get(l.train.number), now) for l in o.legs],
            }
        )
    timelines = {}
    for hit, primary in result.hits:
        stops = result.schedules.get(hit.number)
        if not primary or not stops:
            continue
        try:
            events = build_timeline(stops, hit.board, req.on, req.classes or hit.classes)
        except ValueError:
            continue
        nxt = next((e for e in events if e.when >= now), None)
        timelines[hit.number] = [
            {
                "at": int(e.when.timestamp() * 1000),
                "when": e.when.strftime("%a %d %b, %H:%M"),
                "relative": relative(e.when, now),
                "passed": e.when < now,
                "next": e is nxt,
                "label": e.label,
                "note": e.note,
            }
            for e in events
        ]
    stamps = sorted(l.avail.fetched_at for o in result.options for l in o.legs if l.avail.fetched_at)
    return {
        "origin": req.origin,
        "dest": req.dest,
        "date": req.on.isoformat(),
        "date_label": req.on.strftime("%a %d %b %Y"),
        "demo": provider.name == "demo",
        "trains_found": result.trains_found,
        "checked": result.checked,
        "skipped": result.skipped,
        "requests_used": getattr(provider, "calls", 0) if provider.name != "demo" else 0,
        "notes": result.notes,
        "fetched_from": stamps[0] if stamps else "",
        "fetched_to": stamps[-1] if stamps else "",
        "options": options,
        "timelines": timelines,
    }


class App:
    def __init__(self, root: Path, env: dict):
        self.root = root
        self.env = env
        self.cache = Cache(root / ".railseek_cache")

    @property
    def has_key(self) -> bool:
        return True  # the default data source needs no key

    def provider(self, body: dict):
        budget = _int(body, "max_requests", 60, 1, 500)
        return make_provider("demo" if body.get("demo") else "auto", self.env, self.cache, budget)

    def meta(self) -> dict:
        today = datetime.now(IST).date()
        return {
            "has_key": self.has_key,
            "today": today.isoformat(),
            "max_date": (today + timedelta(days=62)).isoformat(),
            "classes": ALL_CLASSES,
            "min_watch_minutes": MIN_INTERVAL_MIN,
        }

    def search(self, body: dict) -> dict:
        req = parse_request(body)
        provider = self.provider(body)
        with _search_lock:
            result = search(provider, req)
        return serialize(result, req, provider)

    def watch(self, body: dict) -> dict:
        req = parse_request(body)
        provider = self.provider(body)
        interval = _int(body, "every", 15, MIN_INTERVAL_MIN, 240)
        alerts: list[str] = []
        folder = self.root / ".railseek_state" / ("demo" if provider.name == "demo" else "live")
        with _search_lock:
            result = tick(provider, req, state_path(folder, req), interval, send=alerts.append)
        out = serialize(result, req, provider)
        out["alerts"] = alerts
        return out


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        server_version = "railseek"

        def log_message(self, fmt, *args):  # keep the terminal quiet
            pass

        def _send(self, code: int, body: bytes, ctype: str):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code: int, obj):
            self._send(code, json.dumps(obj).encode(), "application/json; charset=utf-8")

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self._send(200, (STATIC / "index.html").read_bytes(), "text/html; charset=utf-8")
            elif self.path == "/api/meta":
                self._json(200, app.meta())
            else:
                self._json(404, {"error": "Not found"})

        def do_POST(self):
            routes = {"/api/search": app.search, "/api/watch": app.watch}
            fn = routes.get(self.path)
            if fn is None:
                return self._json(404, {"error": "Not found"})
            # only this page may call the API: refuse cross-site form posts
            if "application/json" not in (self.headers.get("Content-Type") or ""):
                return self._json(415, {"error": "JSON only"})
            try:
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(min(length, 20000)) or b"{}")
                if not isinstance(body, dict):
                    raise BadRequest("Bad request")
                self._json(200, fn(body))
            except BadRequest as e:
                self._json(400, {"error": str(e)})
            except ProviderError as e:
                self._json(502, {"error": str(e)})
            except ValueError:
                self._json(400, {"error": "Bad request"})

    return Handler


def serve(root: Path, env: dict, port: int = 8765, open_browser: bool = False) -> int:
    app = App(root, env)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(app))
    url = f"http://localhost:{port}"
    print(f"railseek is running at {url}  (Ctrl-C to stop)", flush=True)
    if open_browser:
        import webbrowser

        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0
