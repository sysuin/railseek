import unittest
from datetime import date

from railseek.engine import SearchRequest, plan_candidates, search
from railseek.models import Avail, Stop, TrainHit
from railseek.providers import BudgetExceeded
from railseek.providers.demo import DemoProvider
from railseek.providers.irctc1 import Irctc1Provider
from railseek.status import parse_status, score

D = date(2026, 11, 19)


class StatusTests(unittest.TestCase):
    def test_parse(self):
        cases = {
            "AVAILABLE-0012": ("AVAILABLE", 12, ""),
            "CURR_AVBL-0005": ("AVAILABLE", 5, ""),
            "RAC 5": ("RAC", 5, ""),
            "RAC12/RAC 7": ("RAC", 7, ""),
            "GNWL23/WL12": ("WL", 12, "GNWL"),
            "RLWL5/WL3": ("WL", 3, "RLWL"),
            "PQWL 40": ("WL", 40, "PQWL"),
            "WL 15": ("WL", 15, ""),
            "REGRET/WL 9": ("REGRET", None, ""),
            "TRAIN DEPARTED": ("DEPARTED", None, ""),
            "NOT AVAILABLE": ("NA", None, ""),
            "": ("UNKNOWN", None, ""),
        }
        for raw, (kind, count, wl) in cases.items():
            a = parse_status(raw)
            self.assertEqual((a.kind, a.count, a.wl_type), (kind, count, wl), raw)

    def test_score_order(self):
        order = ["AVAILABLE-0003", "RAC 4", "GNWL5/WL2", "PQWL30/WL25", "REGRET"]
        scores = [score(parse_status(s)) for s in order]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertGreater(score(parse_status("AVAILABLE-1"), tier=5), score(parse_status("RAC 1"), tier=0))


def stops():
    rows = [("AAA", 1, 1300), ("BBB", 1, 1400), ("CCC", 2, 60), ("DDD", 2, 300), ("EEE", 2, 600), ("FFF", 3, 30)]
    return [Stop(c, c, i, day, m) for i, (c, day, m) in enumerate(rows)]


class PlanTests(unittest.TestCase):
    def plan(self, **kw):
        hit = TrainHit("11111", "T", "CCC", "EEE", ["SL", "3A"])
        return plan_candidates(hit, stops(), SearchRequest("CCC", "EEE", D, **kw), primary=True)

    def test_kinds_and_dates(self):
        cands = self.plan(classes=["3A"])
        got = {(c.kind, c.book_from, c.book_to, c.book_date) for c in cands}
        self.assertIn(("exact", "CCC", "EEE", D), got)
        # train leaves AAA and BBB the calendar day before it reaches CCC
        self.assertIn(("earlier-origin", "AAA", "EEE", date(2026, 11, 18)), got)
        self.assertIn(("earlier-origin", "BBB", "EEE", date(2026, 11, 18)), got)
        self.assertIn(("later-destination", "CCC", "FFF", D), got)
        self.assertIn(("both-extended", "AAA", "FFF", date(2026, 11, 18)), got)
        self.assertTrue(all(c.board == "CCC" and c.alight == "EEE" for c in cands))

    def test_never_offers_own_station_as_earlier_origin(self):
        hit = TrainHit("11111", "T", "BBB", "EEE", ["SL"])
        cands = plan_candidates(hit, stops(), SearchRequest("BBB", "EEE", D), True)
        self.assertEqual([c.book_from for c in cands if c.kind == "earlier-origin"], ["AAA"])

    def test_class_filter_and_splits(self):
        self.assertEqual({c.cls for c in self.plan(classes=["2A", "SL"])}, {"SL"})
        legs = [c for c in self.plan(classes=["SL"], splits=1) if c.kind == "split-leg"]
        self.assertEqual([(c.book_from, c.book_to) for c in legs], [("CCC", "DDD"), ("DDD", "EEE")])

    def test_no_extension_at_route_ends_or_alt_station(self):
        hit = TrainHit("11111", "T", "AAA", "FFF", ["SL"])
        req = SearchRequest("AAA", "FFF", D)
        self.assertEqual([c.kind for c in plan_candidates(hit, stops(), req, True)], ["exact"])
        hit2 = TrainHit("11111", "T", "CCC", "EEE", ["SL"])
        self.assertEqual([c.kind for c in plan_candidates(hit2, stops(), req, False)], ["alt-station"])


class SearchTests(unittest.TestCase):
    def test_demo_finds_workaround(self):
        res = search(DemoProvider(), SearchRequest("SSM", "NDLS", D, also_to=["DLI"], also_from=["DDU"]))
        self.assertEqual(res.trains_found, 4)  # 90004 starts at DDU, one of the also_from stations
        best = res.options[0]
        self.assertEqual(best.legs[0].avail.kind, "AVAILABLE")
        self.assertEqual(best.kind, "earlier-origin")
        self.assertEqual(best.legs[0].board, "SSM")
        scores = [o.score for o in res.options]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_budget_stops_cleanly(self):
        class Limited(DemoProvider):
            def availability(self, *a):
                if self.calls >= 5:
                    raise BudgetExceeded("request budget of 5 used up")
                return super().availability(*a)

        res = search(Limited(), SearchRequest("SSM", "NDLS", D))
        self.assertEqual(res.checked, 5)
        self.assertGreater(res.skipped, 0)
        self.assertTrue(any("Stopped early" in n for n in res.notes))

    def test_skips_workarounds_when_exact_is_open(self):
        class Open(DemoProvider):
            def availability(self, train_no, frm, to, on, cls, quota):
                self.calls += 1
                return Avail("AVAILABLE-0009", "AVAILABLE", 9)

        res = search(Open(), SearchRequest("SSM", "NDLS", D))
        self.assertTrue(all(o.kind == "exact" for o in res.options))


class FakeIrctc1(Irctc1Provider):
    def __init__(self, payload):
        self.payload = payload

    def _get(self, url, params, headers, ttl):
        return self.payload, "2026-11-17T12:00:00+05:30", False


class Irctc1ParsingTests(unittest.TestCase):
    def test_availability_picks_requested_date(self):
        p = FakeIrctc1({"status": True, "data": [
            {"date": "18-11-2026", "current_status": "REGRET"},
            {"date": "19-11-2026", "current_status": "GNWL12/WL6", "confirm_probability_percent": "71", "total_fare": 1540},
        ]})
        p._headers, p._railradar_key = {}, ""
        a = p.availability("12801", "PURI", "NDLS", D, "3A", "GN")
        self.assertEqual((a.kind, a.count, a.probability, a.fare), ("WL", 6, 71.0, 1540.0))

    def test_availability_v2_shape_from_live_response(self):
        # trimmed copy of a real response, 17 Nov 2026: 12801 SSM-ANVT 3A GN
        p = FakeIrctc1({"status": True, "message": "Success", "data": {"trainCode": "12801", "availabilityClassList": [{
            "reservationClass": "3A",
            "charges": {"totalCollectibleAmount": 1315.4, "baseFare": 1134, "totalFare": 1280},
            "availabilities": [
                {"date": "2026-11-18", "status": "RLWL67/WL23", "type": "WL", "prediction": 0.28},
                {"date": "2026-11-19", "status": "REGRET", "type": "REGRET"},
            ]}]}})
        p._headers, p._railradar_key = {}, ""
        a = p.availability("12801", "SSM", "ANVT", date(2026, 11, 18), "3A", "GN")
        self.assertEqual((a.kind, a.wl_type, a.wl_running, a.count, a.probability, a.fare), ("WL", "RLWL", 67, 23, 28.0, 1280.0))
        self.assertEqual(p.availability("12801", "SSM", "ANVT", D, "3A", "GN").kind, "REGRET")
        self.assertEqual(p.availability("12801", "SSM", "ANVT", date(2026, 11, 25), "3A", "GN").kind, "UNKNOWN")

    def test_trains_between_from_live_response(self):
        p = FakeIrctc1({"status": True, "data": [{
            "train_number": "12801", "train_name": "Purushottam Express ", "from_std": "14:58", "to_sta": "03:50",
            "from_day": 1, "to_day": 2, "from": "SSM", "to": "ANVT", "duration": "12:52",
            "train_date": "18-11-2026", "class_type": ["SL", "3E", "3A", "2A", "1A"]}]})
        p._headers, p._railradar_key = {}, ""
        (h,) = p.trains_between("SSM", "NDLS", D)
        self.assertEqual((h.number, h.board, h.alight, h.classes[0]), ("12801", "SSM", "ANVT", "SL"))

    def test_availability_never_borrows_another_date(self):
        p = FakeIrctc1({"status": True, "data": [{"date": "18-11-2026", "current_status": "AVAILABLE-0004"}]})
        p._headers, p._railradar_key = {}, ""
        self.assertEqual(p.availability("1", "A", "B", D, "SL", "GN").kind, "UNKNOWN")

    def test_schedule_both_shapes(self):
        rapid = {"data": {"route": [
            {"station_code": "AAA", "station_name": "A", "day": 1, "std_min": 1300, "stop": True},
            {"station_code": "XXX", "station_name": "X", "day": 1, "std_min": 1350, "stop": False},
            {"station_code": "BBB", "station_name": "B", "day": 2, "std_min": 1500, "stop": True},
        ]}}
        radar = {"data": {"route": [
            {"station": {"code": "AAA", "name": "A"}, "isHalt": True, "departure": "21:40", "departureDay": 1},
            {"station": {"code": "BBB", "name": "B"}, "isHalt": True, "arrival": "01:00", "arrivalDay": 2},
        ]}}
        for payload in (rapid, radar):
            p = FakeIrctc1(payload)
            p._headers, p._railradar_key = {}, ""
            s = p.schedule("1")
            self.assertEqual([(x.code, x.day) for x in s], [("AAA", 1), ("BBB", 2)])


class TimelineTests(unittest.TestCase):
    def test_overnight_train_counts_from_origin(self):
        from railseek.timeline import build_timeline
        st = [Stop("PURI", "Puri", 0, 1, 21 * 60 + 55), Stop("SSM", "Sasaram", 1, 2, 14 * 60 + 58), Stop("ANVT", "AV", 2, 3, 0)]
        ev = {e.kind: e for e in build_timeline(st, "SSM", D, ["3A", "SL"])}
        fmt = lambda k: ev[k].when.strftime("%d %H:%M")
        self.assertEqual(fmt("tatkal-ac"), "17 10:00")  # train starts 18 Nov, Tatkal the day before
        self.assertEqual(fmt("tatkal-nonac"), "17 11:00")
        self.assertIn("18 Nov", ev["tatkal-ac"].note)
        self.assertEqual(fmt("emergency-quota"), "17 16:00")
        self.assertEqual(fmt("first-chart"), "18 11:55")  # 10 hours before 21:55
        self.assertEqual(fmt("refund-0"), "19 06:58")
        self.assertEqual(fmt("current-closes"), "19 14:28")

    def test_morning_train(self):
        from railseek.timeline import build_timeline
        st = [Stop("AAA", "A", 0, 1, 6 * 60), Stop("BBB", "B", 1, 1, 9 * 60)]
        ev = {e.kind: e for e in build_timeline(st, "AAA", D, ["SL"])}
        self.assertNotIn("tatkal-ac", ev)
        self.assertEqual(ev["tatkal-nonac"].note, "")
        self.assertEqual(ev["first-chart"].when.strftime("%d %H:%M"), "18 20:00")
        self.assertEqual(ev["emergency-quota"].when.strftime("%d %H:%M"), "18 12:00")


class WatchTests(unittest.TestCase):
    def test_alerts_on_change_only(self):
        import tempfile
        from datetime import datetime
        from pathlib import Path
        from railseek.timeline import IST
        from railseek.watch import tick

        class Flip(DemoProvider):
            opened = False

            def availability(self, train_no, frm, to, on, cls, quota):
                if self.opened and train_no == "90001" and frm == "SSM" and cls == "3A":
                    return Avail("AVAILABLE-0002", "AVAILABLE", 2)
                return super().availability(train_no, frm, to, on, cls, quota)

        p, sent = Flip(), []
        req = SearchRequest("SSM", "NDLS", D, classes=["3A"], upstream=0, downstream=0)
        now = datetime(2026, 11, 14, 9, 0, tzinfo=IST)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "s.json"
            tick(p, req, path, 15, now, sent.append)
            self.assertEqual(sent, [])  # nothing bookable outright, no reminders due
            tick(p, req, path, 15, now, sent.append)
            self.assertEqual(sent, [])  # unchanged
            p.opened = True
            tick(p, req, path, 15, now, sent.append)
            self.assertEqual(len(sent), 1)
            self.assertIn("Opened up: 90001 3A/GN SSM-NDLS", sent[0])
            self.assertIn("was REGRET", sent[0])
            tick(p, req, path, 15, now, sent.append)
            self.assertEqual(len(sent), 1)  # no repeat

    def test_tatkal_reminder_fires_once(self):
        import tempfile
        from datetime import datetime
        from pathlib import Path
        from railseek.timeline import IST
        from railseek.watch import tick

        sent = []
        req = SearchRequest("SSM", "NDLS", D, classes=["3A"], trains=["90002"], upstream=0, downstream=0)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "s.json"
            tick(DemoProvider(), req, path, 15, datetime(2026, 11, 18, 9, 0, tzinfo=IST), sent.append)
            self.assertEqual(sent, [])  # too early: Tatkal opens 18 Nov 10:00
            tick(DemoProvider(), req, path, 15, datetime(2026, 11, 18, 9, 40, tzinfo=IST), sent.append)
            tick(DemoProvider(), req, path, 15, datetime(2026, 11, 18, 9, 55, tzinfo=IST), sent.append)
            self.assertEqual(len(sent), 1)
            self.assertIn("Tatkal opens for AC classes at 10:00 on 18 Nov", sent[0])


class HandoffTests(unittest.TestCase):
    def sheet(self, **kw):
        from datetime import datetime
        from railseek.handoff import build_sheet
        from railseek.models import Candidate
        from railseek.timeline import IST

        st = [Stop("PURI", "Puri", 0, 1, 21 * 60 + 55), Stop("SSM", "Sasaram", 1, 2, 14 * 60 + 58), Stop("ANVT", "AV", 2, 3, 0)]
        args = dict(kind="earlier-origin", book_from="PURI", book_date=date(2026, 11, 18), quota="GN", avail=parse_status("GNWL12/WL6"))
        args.update(kw)
        c = Candidate(TrainHit("12801", "Purushottam", "SSM", "ANVT"), args["kind"], 1, args["book_from"], "ANVT", "SSM", "ANVT",
                      args["book_date"], "3A", args["quota"], avail=args["avail"])
        return build_sheet(c, st, datetime(2026, 11, 16, 9, 0, tzinfo=IST))

    def test_earlier_origin_sheet(self):
        s = self.sheet()
        self.assertIn("From      PURI", s)
        self.assertIn("Date      Wed 18 Nov 2026   (the day the train leaves PURI; you board on 19 Nov)", s)
        self.assertIn("Boarding  SSM", s)
        self.assertIn("set the boarding station to SSM", s)
        self.assertIn("This is a waitlist", s)
        self.assertNotIn("Tatkal", s)

    def test_tatkal_sheet(self):
        s = self.sheet(kind="exact", book_from="SSM", book_date=D, quota="TQ", avail=None)
        self.assertIn("Tatkal opens Tue 17 Nov at 10:00 (in 1d 1h)", s)
        self.assertIn("Aadhaar-authenticated", s)
        self.assertNotIn("Boarding  ", s)
        self.assertNotIn("Refund:", s)


class ConfirmTktTests(unittest.TestCase):
    """Shapes copied from real responses on 18 Nov 2026, trimmed."""

    SEARCH = {"data": {"trainList": [
        {"trainNumber": "12397", "trainName": "MAHABODHI EXP", "fromStnCode": "SSM", "toStnCode": "NDLS", "departureTime": "15:28",
         "arrivalTime": "04:10", "duration": 762, "avlClasses": ["SL", "3A"],
         "availabilityCache": {
             "3A": {"availability": "GNWL181/WL80", "predictionPercentage": 12, "fare": "1390", "date": "2026-11-19T00:00:00", "cacheTime": "2026-11-18T10:14:02.001"},
             "SL": {"availability": "REGRET", "predictionPercentage": 0, "fare": "540", "date": "2026-11-19T00:00:00", "cacheTime": "2026-11-18T09:46:00.001"}},
         "availabilityCacheTatkal": {
             "SL": {"availability": "AVAILABLE-0072#", "fare": "640", "date": "2026-11-19T00:00:00", "cacheTime": "2026-11-18T11:00:10.001"},
             "3A": {"availability": "NOT AVAILABLE", "fare": "0", "date": "2026-11-19T00:00:00", "cacheTime": "2026-11-18T10:28:34.001"}}},
        {"trainNumber": "12801", "trainName": "PURUSHOTTAM SF", "fromStnCode": "SSM", "toStnCode": "ANVT", "departureTime": "14:58",
         "arrivalTime": "03:50", "duration": 772, "avlClasses": ["3A"],
         "availabilityCache": {"3A": {"availability": "RLWL7/WL3", "predictionPercentage": 53, "fare": "1280", "date": "2026-11-20T00:00:00", "cacheTime": "2026-11-18T02:43:00.001"}}},
    ]}}

    def provider(self):
        from railseek.providers.confirmtkt import ConfirmTktProvider

        calls = []

        class Fake(ConfirmTktProvider):
            def _get(inner, url, params, headers, ttl):
                calls.append(params)
                return self.SEARCH, "2026-11-18T11:05:00+05:30", False

        from railseek.cache import Cache
        from pathlib import Path

        return Fake(Cache(Path("/nonexistent"), enabled=False), 10), calls

    def test_one_request_serves_trains_and_all_classes(self):
        p, calls = self.provider()
        hits = p.trains_between("SSM", "NDLS", D)
        self.assertEqual([(h.number, h.board, h.alight, h.duration) for h in hits], [("12397", "SSM", "NDLS", "12:42"), ("12801", "SSM", "ANVT", "12:52")])
        self.assertEqual(calls[0]["dateOfJourney"], "19-11-2026")
        a = p.availability("12397", "SSM", "NDLS", D, "3A", "GN")
        self.assertEqual((a.kind, a.wl_type, a.count, a.probability, a.fare, a.fetched_at), ("WL", "GNWL", 80, 12.0, 1390.0, "2026-11-18T10:14:02+05:30"))
        self.assertEqual(p.availability("12397", "SSM", "NDLS", D, "SL", "GN").kind, "REGRET")
        t = p.availability("12397", "SSM", "NDLS", D, "SL", "TQ")
        self.assertEqual((t.kind, t.count, t.fare), ("AVAILABLE", 72, 640.0))
        self.assertIsNone(p.availability("12397", "SSM", "NDLS", D, "3A", "TQ").fare)
        self.assertEqual(len(calls), 1)  # everything above came from the one response

    def test_gaps_are_reported_not_guessed(self):
        p, calls = self.provider()
        p.trains_between("SSM", "NDLS", D)
        self.assertEqual(p.availability("12801", "SSM", "ANVT", D, "3A", "GN").kind, "UNKNOWN")  # response is for another date
        self.assertEqual(p.availability("12397", "SSM", "NDLS", D, "2A", "GN").kind, "NA")  # class absent
        self.assertEqual(p.availability("12397", "SSM", "NDLS", D, "3A", "LD").kind, "UNKNOWN")  # quota not covered
        self.assertEqual(p.availability("99999", "SSM", "NDLS", D, "3A", "GN").kind, "NA")  # train not on this pair
        self.assertEqual(len(calls), 1)
        self.assertEqual(p.availability("12397", "GAYA", "NDLS", D, "3A", "GN").kind, "NA")  # new pair: one more request
        self.assertEqual(len(calls), 2)

    def test_schedule(self):
        from railseek.providers.confirmtkt import parse_schedule

        s = parse_schedule({"Schedule": [
            {"StationCode": "PURI", "StationName": "PURI", "ArrivalTime": "", "DepartureTime": "21:55", "Day": 1, "Distance": 0.0},
            {"StationCode": "SSM", "StationName": "SASARAM", "ArrivalTime": "14:56", "DepartureTime": "14:58", "Day": 2, "Distance": 971.0},
            {"StationCode": "ANVT", "StationName": "ANAND VIHAR TRM", "ArrivalTime": "03:50", "DepartureTime": "", "Day": 3, "Distance": 1846.0}]}, "12801")
        self.assertEqual([(x.code, x.day, x.dep_min) for x in s], [("PURI", 1, 1315), ("SSM", 2, 898), ("ANVT", 3, 230)])


if __name__ == "__main__":
    unittest.main()
