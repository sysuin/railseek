from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict
from datetime import date, datetime, timedelta
from pathlib import Path

from .cache import Cache
from .engine import Option, SearchRequest, SearchResult, search
from .providers import ProviderError, make_provider
from .handoff import IRCTC_URL, build_sheet, checklist
from .models import Candidate, TrainHit
from .timeline import build_timeline, render_timeline
from .watch import MIN_INTERVAL_MIN, run_watch

ROOT = Path(__file__).resolve().parent.parent


def load_env() -> dict:
    env = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    env.update({k: v for k, v in os.environ.items() if k in ("RAPIDAPI_KEY", "RAILRADAR_KEY")})
    return env


def parse_date(text: str) -> date:
    t = text.lower()
    if t == "today":
        return date.today()
    if t == "tomorrow":
        return date.today() + timedelta(days=1)
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(f"date {text!r} should look like 2026-11-19, 19-11-2026, today or tomorrow")


def codes(text: str) -> list[str]:
    return [c.strip().upper() for c in text.split(",") if c.strip()]


def how(o: Option, req: SearchRequest) -> str:
    c = o.legs[0]
    if o.kind == "split":
        mid = c.book_to
        return f"Two tickets on the same train: {c.book_from}-{mid} and {mid}-{o.legs[1].book_to}. Berth may change at {mid}."
    parts = []
    if c.kind in ("earlier-origin", "both-extended"):
        parts.append(f"Book from {c.book_from} and set boarding point to {c.board}")
        if c.book_date != req.on:
            parts.append(f"journey date on IRCTC is {c.book_date:%d %b} (when the train leaves {c.book_from})")
    if c.kind in ("later-destination", "both-extended"):
        parts.append(f"Book to {c.book_to}, get off at {c.alight}")
    if c.kind == "alt-station":
        parts.append(f"Get to {c.board} first")
    if c.alight != req.dest:
        parts.append(f"arrives at {c.alight}")
    return "; ".join(parts) or "Book as searched"


def status_text(o: Option) -> str:
    return " + ".join(leg.avail.raw or leg.avail.kind for leg in o.legs)


def render(result: SearchResult, req: SearchRequest, limit: int, show_closed: bool, demo: bool) -> str:
    lines = []
    if demo:
        lines.append("DEMO DATA: trains, timings and availability below are invented.\n")
    lines.append(
        f"{req.origin} -> {req.dest} on {req.on:%a %d %b %Y}: {result.trains_found} trains, "
        f"{result.checked} availability checks, {result.skipped} not made."
    )
    open_opts = [o for o in result.options if o.score > 0]
    closed = [o for o in result.options if o.score <= 0]
    rows = [("#", "Train", "Cls/Q", "Book", "Status", "Chance", "Fare", "As of", "How")]
    for i, o in enumerate(open_opts[:limit], 1):
        c = o.legs[0]
        probs = [leg.avail.probability for leg in o.legs if leg.avail.kind == "WL" and leg.avail.probability is not None]
        fares = [leg.avail.fare for leg in o.legs]
        rows.append(
            (
                str(i),
                f"{c.train.number} {c.train.name[:22]}",
                f"{c.cls}/{c.quota}",
                f"{c.book_from}-{o.legs[-1].book_to} {c.book_date:%d%b}",
                status_text(o),
                f"{min(probs):.0f}%" if probs else "",
                f"{sum(fares):.0f}" if all(f is not None for f in fares) else "",
                min((leg.avail.fetched_at[5:16].replace("T", " ") for leg in o.legs if leg.avail.fetched_at), default=""),
                how(o, req),
            )
        )
    if len(rows) == 1:
        lines.append("\nNothing bookable found in what was checked.")
    else:
        widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]) - 1)]
        lines.append("")
        for r in rows:
            lines.append("  ".join(cell.ljust(w) for cell, w in zip(r, widths)) + "  " + r[-1])
        if len(open_opts) > limit:
            lines.append(f"... {len(open_opts) - limit} more (use --limit)")
    if closed:
        lines.append(f"\n{len(closed)} checked combinations are closed (regret, not available or error).")
        if show_closed:
            for o in closed:
                c = o.legs[0]
                lines.append(f"  {c.train.number} {c.cls}/{c.quota} {c.book_from}-{c.book_to} {c.book_date:%d%b}: {status_text(o)}")
    stamps = sorted(leg.avail.fetched_at for o in result.options for leg in o.legs if leg.avail.fetched_at)
    if stamps:
        lines.append(f"\nFigures date from {stamps[0][:16]} to {stamps[-1][:16]} (see As of), from an unofficial source.")
    lines.append("Check the option on IRCTC before paying; IRCTC is the final authority.")
    if any(o.kind in ("earlier-origin", "both-extended") for o in open_opts[:limit]):
        lines.append(
            "Earlier-origin tickets cost more and need the boarding point set to your station, "
            "or the berth can be given away. Whether Tatkal tickets allow a boarding change is unconfirmed."
        )
    for n in result.notes:
        lines.append(f"Note: {n}")
    return "\n".join(lines)


def to_json(result: SearchResult, req: SearchRequest) -> str:
    def leg(c):
        return {
            "train": c.train.number,
            "train_name": c.train.name,
            "kind": c.kind,
            "book_from": c.book_from,
            "book_to": c.book_to,
            "board": c.board,
            "alight": c.alight,
            "book_date": c.book_date.isoformat(),
            "class": c.cls,
            "quota": c.quota,
            "availability": asdict(c.avail),
        }

    return json.dumps(
        {
            "origin": req.origin,
            "dest": req.dest,
            "date": req.on.isoformat(),
            "trains_found": result.trains_found,
            "checked": result.checked,
            "skipped": result.skipped,
            "notes": result.notes,
            "options": [
                {"score": o.score, "kind": o.kind, "how": how(o, req), "legs": [leg(c) for c in o.legs]}
                for o in result.options
            ],
        },
        indent=2,
    )


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="railseek", description="Read-only station-pair seat search for Indian Railways.")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--provider", default="auto", choices=["auto", "confirmtkt", "irctc1", "demo"])
        sp.add_argument("--max-requests", type=int, default=100, help="cap on live API requests (default 100)")
        sp.add_argument("--no-cache", action="store_true")

    def journey(s):
        s.add_argument("origin")
        s.add_argument("dest")
        s.add_argument("date", type=parse_date)
        s.add_argument("--also-from", type=codes, default=[], help="other stations you could start from, e.g. DDU,GAYA")
        s.add_argument("--also-to", type=codes, default=[], help="other acceptable arrival stations, e.g. DLI,ANVT,NZM")
        s.add_argument("--classes", type=codes, default=[], help="in order of preference, e.g. 3A,SL (default: all)")
        s.add_argument("--quotas", type=codes, default=["GN"], help="GN, TQ, PT, LD, SS ... (default GN)")
        s.add_argument("--trains", type=codes, default=[], help="only these train numbers")
        s.add_argument("--upstream", type=int, default=3, help="earlier stations to try per train (default 3)")
        s.add_argument("--downstream", type=int, default=1, help="later stations to try per train (default 1)")
        s.add_argument("--splits", type=int, default=0, help="midway stations to try as a two-ticket split (default 0)")
        s.add_argument("--limit", type=int, default=25)
        s.add_argument("--show-closed", action="store_true")
        common(s)

    s = sub.add_parser("search", help="sweep trains, station pairs and classes for a journey")
    journey(s)
    s.add_argument("--json", action="store_true")
    s.add_argument("--pick", type=int, default=0, metavar="N", help="also print the booking sheet for result number N")

    w = sub.add_parser("watch", help="repeat a search on a timer and alert when something opens up")
    journey(w)
    w.add_argument("--every", type=int, default=15, help=f"minutes between checks (default 15, minimum {MIN_INTERVAL_MIN})")
    w.add_argument("--once", action="store_true", help="check once and exit (for cron or testing)")

    t = sub.add_parser("timeline", help="key moments for one train: Tatkal opening, chart, deadlines, refund slabs")
    t.add_argument("train")
    t.add_argument("board", help="station you board at")
    t.add_argument("date", type=parse_date, help="date the train leaves your station")
    t.add_argument("--classes", type=codes, default=[], help="classes you care about (default 3A,SL)")
    common(t)

    h = sub.add_parser("handoff", help="booking sheet: exactly what to enter on IRCTC, plus a checklist")
    h.add_argument("train")
    h.add_argument("book_from", metavar="from", help="station to book from")
    h.add_argument("book_to", metavar="to", help="station to book to")
    h.add_argument("date", type=parse_date, help="journey date to enter on IRCTC (the day the train leaves FROM)")
    h.add_argument("cls", metavar="class")
    h.add_argument("--quota", default="GN")
    h.add_argument("--board", default="", help="station you actually board at, if later than FROM")
    h.add_argument("--alight", default="", help="station you actually get off at, if earlier than TO")
    h.add_argument("--check", action="store_true", help="fetch the route and current status first (uses up to 2 requests)")
    h.add_argument("--open", action="store_true", help="also open the IRCTC site in your browser")
    common(h)

    sv = sub.add_parser("serve", help="run the web page on this computer")
    sv.add_argument("--port", type=int, default=8765)
    sv.add_argument("--open", action="store_true", help="open the page in your browser")

    pp = sub.add_parser("prep", help="checklist to run through before booking")
    pp.add_argument("--tatkal", action="store_true")

    pr = sub.add_parser("probe", help="print one raw API response (for checking the data source)")
    pr.add_argument("what", choices=["trains", "schedule", "avail"])
    pr.add_argument("args", nargs="+", help="trains FROM TO DATE | schedule TRAIN | avail TRAIN FROM TO DATE CLASS [QUOTA]")
    common(pr)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    if args.cmd == "serve":
        from .web import serve

        return serve(ROOT, load_env(), args.port, args.open)
    if args.cmd == "prep":
        print("Before you book" + (" (Tatkal)" if args.tatkal else ""))
        for item in checklist(args.tatkal):
            print(f"  [ ] {item}")
        return 0
    cache = Cache(ROOT / ".railseek_cache", enabled=not args.no_cache)
    try:
        provider = make_provider(args.provider, load_env(), cache, args.max_requests)
    except ProviderError as e:
        print(e, file=sys.stderr)
        return 2

    if args.cmd == "probe":
        if provider.name == "demo":
            print("probe needs a live provider", file=sys.stderr)
            return 2
        a = args.args
        try:
            if args.what == "trains":
                data = provider.raw_trains(a[0].upper(), a[1].upper(), parse_date(a[2]))
            elif args.what == "schedule":
                data = provider.raw_schedule(a[0])
            else:
                quota = a[5].upper() if len(a) > 5 else "GN"
                data = provider.raw_availability(a[0], a[1].upper(), a[2].upper(), parse_date(a[3]), a[4].upper(), quota)
        except IndexError:
            print("not enough arguments; see railseek probe --help", file=sys.stderr)
            return 2
        except ProviderError as e:
            print(e, file=sys.stderr)
            return 1
        print(json.dumps(data[0], indent=2)[:6000])
        return 0

    if args.cmd == "handoff":
        frm, to = args.book_from.upper(), args.book_to.upper()
        board, alight = (args.board or frm).upper(), (args.alight or to).upper()
        kind = "exact"
        if board != frm and alight != to:
            kind = "both-extended"
        elif board != frm:
            kind = "earlier-origin"
        elif alight != to:
            kind = "later-destination"
        cand = Candidate(TrainHit(args.train, "", board, alight), kind, 0, frm, to, board, alight, args.date, args.cls.upper(), args.quota.upper())
        stops = None
        if args.check or provider.name == "demo":
            try:
                stops = provider.schedule(args.train)
                cand.avail = provider.availability(args.train, frm, to, args.date, cand.cls, cand.quota)
            except (ProviderError, KeyError) as e:
                print(f"Note: could not check live status: {e}\n", file=sys.stderr)
        else:
            # no live requests without --check, but a route already in the cache is free
            provider.max_requests = 0
            try:
                stops = provider.schedule(args.train)
            except (ProviderError, KeyError):
                stops = None
        if provider.name == "demo":
            print("DEMO DATA: this train and its status are invented.\n")
        print(build_sheet(cand, stops))
        if args.open:
            import subprocess

            subprocess.run(["open", IRCTC_URL], check=False)
        return 0

    if args.cmd == "timeline":
        try:
            stops = provider.schedule(args.train)
            events = build_timeline(stops, args.board.upper(), args.date, args.classes)
        except (ProviderError, KeyError, ValueError) as e:
            print(f"Could not build the timeline: {e}", file=sys.stderr)
            return 1
        title = f"Train {args.train}, boarding {args.board.upper()} on {args.date:%a %d %b %Y}"
        if provider.name == "demo":
            title = "DEMO DATA: this train is invented.\n" + title
        print(render_timeline(title, events))
        return 0

    req = SearchRequest(
        origin=args.origin.upper(),
        dest=args.dest.upper(),
        on=args.date,
        also_from=args.also_from,
        also_to=args.also_to,
        classes=args.classes,
        quotas=args.quotas,
        trains=args.trains,
        upstream=args.upstream,
        downstream=args.downstream,
        splits=args.splits,
    )
    if args.cmd == "watch":
        demo = provider.name == "demo"

        def show(result):
            print(render(result, req, args.limit, args.show_closed, demo), flush=True)
            print("-" * 60, flush=True)

        return run_watch(provider, req, ROOT / ".railseek_state", args.every, args.once, show)

    result = search(provider, req)
    if args.json:
        print(to_json(result, req))
    else:
        print(render(result, req, args.limit, args.show_closed, provider.name == "demo"))
        if args.pick:
            open_opts = [o for o in result.options if o.score > 0]
            if not 1 <= args.pick <= len(open_opts):
                print(f"\n--pick {args.pick}: there are only {len(open_opts)} bookable results.", file=sys.stderr)
                return 2
            for leg in open_opts[args.pick - 1].legs:
                print("\n" + "=" * 60 + "\n")
                print(build_sheet(leg, result.schedules.get(leg.train.number)))
    return 0
