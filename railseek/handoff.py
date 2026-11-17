"""Booking hand-off: a one-screen sheet of exactly what to enter on IRCTC, plus a prep checklist.

railseek stops here. Login, CAPTCHA, OTP and payment are done by the account
holder on IRCTC's own site or app; nothing in this module touches IRCTC.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from .models import Candidate, Stop
from .timeline import AC_CLASSES, IST, Event, build_timeline, relative

QUOTA_NAMES = {
    "GN": "General",
    "TQ": "Tatkal",
    "PT": "Premium Tatkal",
    "LD": "Ladies",
    "SS": "Senior citizen / lower berth",
}
IRCTC_URL = "https://www.irctc.co.in/nget/train-search"


def boarding_date(c: Candidate, stops: list[Stop] | None) -> date | None:
    """Date the train leaves the boarding station, if the route is known."""
    if not stops:
        return c.book_date if c.board == c.book_from else None
    frm = next((s for s in stops if s.code == c.book_from), None)
    brd = next((s for s in stops if s.code == c.board), None)
    if frm is None or brd is None:
        return None
    return c.book_date + timedelta(days=brd.day - frm.day)


def events_for(c: Candidate, stops: list[Stop] | None) -> list[Event]:
    on = boarding_date(c, stops)
    if not stops or on is None:
        return []
    try:
        return build_timeline(stops, c.board, on, [c.cls])
    except ValueError:
        return []


def checklist(tatkal: bool) -> list[str]:
    items = [
        "IRCTC login works on the device you will use (try it today, not at booking time).",
        "Passengers are saved in My Profile > Master List, with names and ages exactly as on their ID.",
        "Payment is ready: IRCTC eWallet topped up, or a UPI app open on your phone. Avoid cards that need a slow bank OTP.",
        "Decide now whether to tick Vikalp (alternate train) and auto-upgrade, so you do not stop to think on the form.",
        "Have a second choice from the search results written down in case the first is gone.",
    ]
    if tatkal:
        items = [
            "Your IRCTC account is Aadhaar-authenticated (My Profile > Authenticate User). Tatkal is refused without it.",
            "The phone linked to your Aadhaar is next to you and has signal, for the booking OTP.",
            "Log in 3 to 5 minutes before opening time. Earlier risks a session timeout; later risks the login queue.",
            "At most 4 passengers per Tatkal booking. A confirmed Tatkal ticket cannot be refunded.",
        ] + items
    return items


def sheet_data(c: Candidate, stops: list[Stop] | None = None, now: datetime | None = None) -> dict:
    """The booking sheet as plain data, for the terminal and the web page alike."""
    now = now or datetime.now(IST)
    tatkal = c.quota in ("TQ", "PT")
    shifted_from = c.book_from != c.board
    shifted_to = c.book_to != c.alight
    travel = boarding_date(c, stops)
    name = f" {c.train.name.strip()}" if c.train.name.strip() else ""
    date_hint = ""
    if shifted_from and travel and travel != c.book_date:
        date_hint = f"(the day the train leaves {c.book_from}; you board on {travel:%d %b})"
    fields = [
        ("Train", f"{c.train.number}{name}", ""),
        ("From", c.book_from, f"(not {c.board}: you book from an earlier station)" if shifted_from else ""),
        ("To", c.book_to, f"(not {c.alight}: you book past your stop)" if shifted_to else ""),
        ("Date", f"{c.book_date:%a %d %b %Y}", date_hint),
        ("Class", c.cls, ""),
        ("Quota", f"{QUOTA_NAMES.get(c.quota, c.quota)} ({c.quota})", ""),
    ]
    if shifted_from:
        fields.append(("Boarding", c.board, "<- must be set, or your berth can be given away"))
    if c.avail is not None:
        seen = c.avail.raw or c.avail.kind
        extra = []
        if c.avail.probability is not None and c.avail.kind == "WL":
            extra.append(f"{c.avail.probability:.0f}% chance")
        if c.avail.fare is not None:
            extra.append(f"about Rs {c.avail.fare:.0f} per adult")
        when = f" at {c.avail.fetched_at[11:16]} on {c.avail.fetched_at[:10]}" if c.avail.fetched_at else ""
        fields.append(("Last seen", f"{seen}{when}" + (f" ({', '.join(extra)})" if extra else ""), ""))

    events = events_for(c, stops)
    by_kind = {e.kind: e for e in events}
    timing = []
    if tatkal:
        opens = by_kind.get("tatkal-ac" if c.cls in AC_CLASSES else "tatkal-nonac")
        if opens:
            timing.append(f"Tatkal opens {opens.when:%a %d %b at %H:%M} ({relative(opens.when, now)}).")
            if opens.note:
                timing.append(opens.note)
        else:
            timing.append(f"Tatkal opens at {'10:00' if c.cls in AC_CLASSES else '11:00'} the day before the train starts its run.")
    dep = by_kind.get("departure")
    if dep:
        timing.append(f"Train leaves {c.board} {dep.when:%a %d %b at %H:%M} ({relative(dep.when, now)}).")
        if tatkal:
            pass
        elif now >= by_kind["refund-0"].when:
            timing.append("Refund: none if you cancel from now on.")
        elif now >= by_kind["refund-50"].when:
            timing.append(f"Refund: cancelling now loses 50% of the fare; nothing back after {by_kind['refund-0'].when:%a %H:%M}.")
        elif now >= by_kind["refund-25"].when:
            timing.append(f"Refund: cancelling now loses 25% of the fare; 50% after {by_kind['refund-50'].when:%a %H:%M}.")

    steps = [
        f"Open IRCTC ({IRCTC_URL}) or the IRCTC Rail Connect app and log in.",
        f"Search From {c.book_from}, To {c.book_to}, date {c.book_date:%d %b %Y}, quota {QUOTA_NAMES.get(c.quota, c.quota)}.",
        f"Find train {c.train.number}, choose class {c.cls}, and check the status shown matches what you expect.",
        "Pick passengers from your Master List.",
    ]
    if shifted_from:
        steps.append(
            f"On the passenger page, set the boarding station to {c.board}. If the page does not offer it, "
            f"change it afterwards under Booked Ticket History > Change Boarding Point (allowed once)."
        )
    steps.append("Review the fare, pay, and save the PNR.")
    if shifted_from:
        steps.append(f"Open the ticket and confirm the boarding point reads {c.board}.")

    cautions = []
    if c.avail is not None and c.avail.kind == "WL":
        cautions.append("This is a waitlist. If it is still waitlisted at charting, an e-ticket is cancelled and refunded, and you cannot board on it.")
    if c.avail is not None and c.avail.kind in ("REGRET", "NA", "DEPARTED", "ERROR", "UNKNOWN"):
        cautions.append("This option was closed or unreadable when last checked. Re-run the search before trying it.")
    if shifted_from:
        cautions.append(f"You pay the fare from {c.book_from}, which is more than from {c.board}.")
        if tatkal:
            cautions.append("Whether a Tatkal ticket allows a boarding-point change is unconfirmed. Check on IRCTC before paying.")
    if shifted_to:
        cautions.append(f"You pay the fare to {c.book_to} and get off early at {c.alight}. Nothing needs changing on the ticket.")
    cautions.append("The status above came from an unofficial source. What IRCTC shows at step 3 is what counts.")
    return {
        "fields": [{"label": l, "value": v, "hint": h} for l, v, h in fields],
        "timing": timing,
        "steps": steps,
        "cautions": cautions,
        "checklist": checklist(tatkal),
        "irctc_url": IRCTC_URL,
    }


def build_sheet(c: Candidate, stops: list[Stop] | None = None, now: datetime | None = None) -> str:
    d = sheet_data(c, stops, now)
    lines = ["BOOKING SHEET: enter these on IRCTC yourself", ""]
    for f in d["fields"]:
        sep = " " if f["label"] == "Last seen" else ""
        lines.append(f"{f['label']:<10}{sep if len(f['label']) >= 10 else ''}{f['value']}" + (f"   {f['hint']}" if f["hint"] else ""))
    if d["timing"]:
        lines += ["", "Timing"] + [f"  {t}" for t in d["timing"]]
    lines += ["", "Steps"] + [f"  {i}. {s}" for i, s in enumerate(d["steps"], 1)]
    lines += ["", "Before you pay"] + [f"  - {x}" for x in d["cautions"]]
    lines += ["", "Be ready"] + [f"  [ ] {x}" for x in d["checklist"]]
    return "\n".join(lines)
