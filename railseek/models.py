from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class Stop:
    code: str
    name: str
    seq: int
    day: int = 1  # 1 = the day the train leaves its first station
    dep_min: int | None = None  # minutes after midnight, local time
    distance_km: float | None = None


@dataclass
class TrainHit:
    """One train returned by a trains-between-stations lookup."""

    number: str
    name: str
    board: str  # station code the train is boarded at
    alight: str
    classes: list[str] = field(default_factory=list)
    depart: str = ""
    arrive: str = ""
    duration: str = ""


@dataclass
class Avail:
    raw: str
    kind: str  # AVAILABLE | RAC | WL | REGRET | NA | DEPARTED | UNKNOWN | ERROR
    count: int | None = None  # seats left, RAC number, or current waitlist position
    wl_type: str = ""  # GNWL, PQWL, RLWL, TQWL ...
    wl_running: int | None = None
    probability: float | None = None  # confirmation chance in percent, if the source gives one
    fare: float | None = None
    fetched_at: str = ""  # ISO timestamp of when the source was asked
    from_cache: bool = False


@dataclass
class Candidate:
    """One thing the user could book: a train, class, quota and station pair."""

    train: TrainHit
    kind: str  # exact | earlier-origin | later-destination | both-extended | alt-station | split-leg
    tier: int
    book_from: str
    book_to: str
    board: str
    alight: str
    book_date: date  # journey date to enter on IRCTC (date at book_from)
    cls: str
    quota: str
    split_group: str = ""
    avail: Avail | None = None

    @property
    def key(self) -> tuple:
        return (self.train.number, self.board, self.alight, self.cls, self.quota)
