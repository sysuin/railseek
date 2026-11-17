"""Station-pair sweep: build every sensible way to book a journey, check each, rank them."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from .models import Avail, Candidate, Stop, TrainHit
from .providers import AccessDenied, BudgetExceeded, ProviderError
from .status import is_bookable, score

ALL_CLASSES = ["SL", "3E", "3A", "2A", "1A", "CC", "2S"]

TIER = {
    "exact": 0,
    "earlier-origin": 1,
    "later-destination": 2,
    "alt-station": 3,
    "both-extended": 4,
    "split-leg": 5,
}


@dataclass
class SearchRequest:
    origin: str
    dest: str
    on: date
    also_from: list[str] = field(default_factory=list)
    also_to: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)  # empty = every class the train has
    quotas: list[str] = field(default_factory=lambda: ["GN"])
    trains: list[str] = field(default_factory=list)  # empty = all trains found
    upstream: int = 3  # earlier stations to try per train (train origin first)
    downstream: int = 1  # later stations to try per train (terminus first)
    splits: int = 0  # intermediate stations to try as a two-ticket split


@dataclass
class Option:
    """One ranked answer. A split journey has two legs, everything else has one."""

    legs: list[Candidate]
    score: float

    @property
    def kind(self) -> str:
        return "split" if len(self.legs) > 1 else self.legs[0].kind


@dataclass
class SearchResult:
    options: list[Option]
    notes: list[str]
    trains_found: int
    checked: int
    skipped: int
    hits: list = field(default_factory=list)  # (TrainHit, is_primary_origin)
    schedules: dict = field(default_factory=dict)  # train number -> list[Stop] or None


def _index(stops: list[Stop], code: str, after: int = -1) -> int | None:
    for i, s in enumerate(stops):
        if i > after and s.code == code:
            return i
    return None


def _pick(indices: list[int], limit: int) -> list[int]:
    out: list[int] = []
    for i in indices:
        if len(out) >= limit:
            break
        if i not in out:
            out.append(i)
    return out


def plan_candidates(
    hit: TrainHit,
    stops: list[Stop] | None,
    req: SearchRequest,
    primary: bool,
) -> list[Candidate]:
    """All ways to book this train for this journey. No network calls."""
    classes = [c for c in (req.classes or hit.classes or ALL_CLASSES) if not hit.classes or c in hit.classes]
    base_kind = "exact" if primary else "alt-station"
    out: list[Candidate] = []

    def add(kind, frm, to, on, group=""):
        for cls in classes:
            for quota in req.quotas:
                out.append(
                    Candidate(hit, kind, TIER[kind], frm, to, hit.board, hit.alight, on, cls, quota, group)
                )

    add(base_kind, hit.board, hit.alight, req.on)
    if not primary or not stops:
        return out
    b = _index(stops, hit.board)
    a = _index(stops, hit.alight, after=b if b is not None else -1)
    if b is None or a is None:
        return out

    def date_at(i: int) -> date:
        # the date IRCTC wants is the date the train leaves the station you book from
        return req.on + timedelta(days=stops[i].day - stops[b].day)

    # train origin first, then the stop just before yours, then ones spread evenly in
    # between: neighbouring stops usually share your quota, distant ones often do not
    spread = [i for i in (round(b * k / req.upstream) for k in range(1, req.upstream)) if i < b] if req.upstream > 1 else []
    ups = _pick([0, b - 1] + spread + list(range(b - 1, 0, -1)), req.upstream) if b > 0 else []
    last = len(stops) - 1
    downs = _pick([last] + list(range(a + 1, last)), req.downstream) if a < last else []
    for u in ups:
        add("earlier-origin", stops[u].code, hit.alight, date_at(u))
    for d in downs:
        add("later-destination", hit.board, stops[d].code, req.on)
    if ups and downs:
        add("both-extended", stops[ups[0]].code, stops[downs[0]].code, date_at(ups[0]))
    between = list(range(b + 1, a))
    if req.splits and between:
        step = max(1, len(between) // (req.splits + 1))
        for x in _pick(between[step - 1 :: step] or between, req.splits):
            group = f"{hit.number}:{stops[x].code}"
            add("split-leg", hit.board, stops[x].code, req.on, group)
            add("split-leg", stops[x].code, hit.alight, date_at(x), group)
    return out


def search(provider, req: SearchRequest) -> SearchResult:
    notes: list[str] = []
    origins = [req.origin] + [s for s in req.also_from if s != req.origin]
    dests = [req.dest] + [s for s in req.also_to if s != req.dest]

    # 1. which trains run
    hits: dict[tuple[str, str], tuple[TrainHit, bool]] = {}
    stopped = False
    for o in origins:
        for d in dests:
            if stopped:
                break
            try:
                found = provider.trains_between(o, d, req.on)
            except (AccessDenied, BudgetExceeded) as e:
                notes.append(f"Stopped looking for trains: {e}")
                stopped = True
                break
            except ProviderError as e:
                notes.append(f"Train list {o}->{d} failed: {e}")
                continue
            for h in found:
                if req.trains and h.number not in req.trains:
                    continue
                hits.setdefault((h.number, o), (h, o == req.origin))
    trains_found = len({number for number, _ in hits})

    # 2. plan every candidate
    schedules: dict[str, list[Stop] | None] = {}
    candidates: list[Candidate] = []
    for (number, _), (hit, primary) in hits.items():
        if primary and number not in schedules:
            try:
                schedules[number] = provider.schedule(number)
            except (AccessDenied, BudgetExceeded) as e:
                notes.append(f"No route for {number}, checking the exact station pair only: {e}")
                schedules[number] = None
            except (ProviderError, KeyError) as e:
                notes.append(f"No route for {number}, checking the exact station pair only: {e}")
                schedules[number] = None
        candidates.extend(plan_candidates(hit, schedules.get(number), req, primary))

    class_rank = {c: i for i, c in enumerate(req.classes or ALL_CLASSES)}
    candidates.sort(key=lambda c: (c.tier, class_rank.get(c.cls, 99)))

    # 3. check them, simplest bookings first, until the budget runs out
    memo: dict[tuple, Avail] = {}
    exact_open: set[tuple] = set()
    checked = skipped = 0
    halted = ""
    for c in candidates:
        if c.tier > 0 and c.kind != "alt-station" and c.key in exact_open:
            continue  # the plain booking already has seats; no need for workarounds
        if halted:
            skipped += 1
            continue
        k = (c.train.number, c.book_from, c.book_to, c.book_date, c.cls, c.quota)
        if k not in memo:
            try:
                memo[k] = provider.availability(c.train.number, c.book_from, c.book_to, c.book_date, c.cls, c.quota)
                checked += 1
            except (AccessDenied, BudgetExceeded) as e:
                halted = str(e)
                skipped += 1
                continue
            except (ProviderError, KeyError) as e:
                memo[k] = Avail(raw=str(e)[:60], kind="ERROR")
        c.avail = memo[k]
        if c.kind == "exact" and c.avail.kind == "AVAILABLE":
            exact_open.add(c.key)
    if halted:
        notes.append(f"Stopped early ({halted}); {skipped} checks were not made.")

    # 4. turn candidates into ranked options
    options: list[Option] = []
    groups: dict[tuple, list[Candidate]] = {}
    for c in candidates:
        if c.avail is None:
            continue
        if c.kind == "split-leg":
            groups.setdefault((c.split_group, c.cls, c.quota), []).append(c)
        else:
            options.append(Option([c], score(c.avail, c.tier)))
    for legs in groups.values():
        if len(legs) == 2 and all(is_bookable(leg.avail) for leg in legs):
            options.append(Option(legs, min(score(leg.avail, leg.tier) for leg in legs)))
    options.sort(key=lambda o: -o.score)
    return SearchResult(options, notes, trains_found, checked, skipped, list(hits.values()), schedules)
