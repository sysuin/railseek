# railseek

Read-only seat search for Indian Railways. For one journey it checks every train, every class,
and other station pairs on the same train (book from an earlier station, book to a later one,
nearby stations, two-ticket splits), then ranks what is actually bookable.

It never logs in to IRCTC and never books. You book the chosen option yourself on IRCTC.

## Web page

```bash
python3 -m railseek serve --open
```

Opens the search page at http://localhost:8765. It runs only on this computer and does everything
the commands below do: search, ranked results, a booking sheet and key moments for each result,
and watching with alerts while the tab stays open. Tick "Use demo data" under More options to try
it on invented trains.

## Public website

The public version lives in `site/` and runs on Cloudflare Pages at https://railseek.pages.dev
(and https://railseek.divkrsh.com once its CNAME record exists). It is a JavaScript port of the
search, timeline and booking sheet; `site/test/parity.mjs` checks it gives the same answers as the
Python code on demo data.

```bash
cd site && npm run deploy
```

- Live data comes from ConfirmTkt's public search (no key). Limits are in `site/wrangler.jsonc`:
  `DAILY_CAP` (upstream requests a day for the whole site), `SEARCH_CAP` (per check) and
  `VISITOR_DAILY_LIVE` (live searches per visitor per day). Setting `DATA_SOURCE` to `irctc1`
  switches back to the RapidAPI key stored as the `RAPIDAPI_KEY` secret, capped by `MONTHLY_CAP`.
- Every search automatically shows the five best options. The page sweeps all trains on the route
  three at a time (`/api/top`): every class, general and Tatkal, booked directly and from each
  train's first station, at most two results per train. Batches keep each call inside the free
  plan's limit of 50 subrequests.
- Visitors can then tap a class on any train to check more station pairs; one such check spends at
  most 6 upstream requests. Answers are shared
  between visitors for 10 minutes, and each result shows how long ago its figure was saved.
- No watching or alerts on the public site, and nothing is stored about visitors beyond a hashed,
  one-day rate-limit counter.
- `npm run dev` in `site/` runs it locally on port 8787 (demo data unless `site/.dev.vars` has a key).

## Try it on made-up data

```bash
python3 -m railseek search SSM NDLS tomorrow --also-to DLI,ANVT --provider demo
```

## Live data

No setup is needed. The default source is ConfirmTkt's public train search, which has no key:

```bash
python3 -m railseek search SSM NDLS tomorrow --quotas GN,TQ
```

- One request per station pair returns every train on it with availability, confirmation chance
  and fare for all classes, in general and Tatkal quota. A full sweep of a busy route takes about
  30 to 40 requests, paced at one a second.
- The figures are ConfirmTkt's saved copies, not instant lookups. The "As of" column shows when
  each was saved; some are minutes old, some a day or more. Confirm on IRCTC before paying.
- It covers general (`GN`) and Tatkal (`TQ`) quota only.
- It is an undocumented endpoint and can change or be blocked without notice. If a search returns
  nothing, run `python3 -m railseek probe trains SSM NDLS tomorrow` and compare the raw response
  with `railseek/providers/confirmtkt.py`.

`--provider irctc1` uses the unofficial "IRCTC" API on RapidAPI instead (key in `.env`, see
`.env.example`). Its free plan allows 10 requests a month; it also covers ladies and senior quota.

## Key moments for a train

```bash
python3 -m railseek timeline 12801 SSM 2026-11-19 --classes 3A,SL
```

Shows when Tatkal opens, the emergency-quota deadline, when the first chart is due (leftover
berths then go on sale as current booking), the refund slabs and departure, each with how far
away it is. The times follow reported 2025-26 rules and are a guide, not IRCTC's word. For trains
that start the day before they reach you, Tatkal is counted from the train's start date and the
note says so.

## Alerts

```bash
python3 -m railseek watch SSM NDLS 2026-11-19 --trains 12801,12397 --classes 3A,SL --every 15
```

Repeats the search every 15 minutes (10 is the minimum) and sends a macOS notification when an
option opens up (regret to waitlist, waitlist to RAC or seats), 10 minutes before Tatkal opens,
and when the first chart is due. Leave the terminal open; Ctrl-C stops it. `--once` checks a
single time. It reads ConfirmTkt's saved figures, so it notices a change only after ConfirmTkt
refreshes its copy.

## Booking sheet

```bash
python3 -m railseek search SSM NDLS 2026-11-19 --classes 3A --pick 1
```

`--pick N` prints a booking sheet for result N: the exact From, To, date, class, quota and
boarding point to enter on IRCTC, the steps in order, what to check before paying, and a
readiness checklist. You can also build one directly, and `--open` opens IRCTC in your browser:

```bash
python3 -m railseek handoff 12801 PURI ANVT 2026-11-18 3A --board SSM --open
```

```bash
python3 -m railseek prep --tatkal
```

The tool stops at the sheet. You log in, solve the CAPTCHA, enter the OTP and pay yourself; it
does not fill IRCTC's forms and stores no passenger, login or payment details.

## Useful options

| Option | Meaning |
|---|---|
| `--also-from`, `--also-to` | Other stations you could start from or arrive at |
| `--classes 3A,SL` | Classes in order of preference (default: all the train has) |
| `--quotas GN,TQ` | Quotas to check (default `GN`; `TQ` is Tatkal) |
| `--trains 12801,12397` | Only these trains |
| `--upstream N`, `--downstream N` | How many earlier / later stations to try per train (default 3 / 1) |
| `--splits N` | Try N midway stations as two tickets on the same train |
| `--max-requests N` | Cap on live API requests per run (default 100) |
| `--json` | Machine-readable output |

Results are cached in `.railseek_cache/` (availability for 10 minutes, routes for 7 days), and the
simplest bookings are checked first, so a small request budget still covers the exact station pair.

## Reading the results

- "Book from X and set boarding point to Y": pay the fare from X, then change the boarding point to
  Y on IRCTC, or the berth can be reallotted. The journey date shown is the date the train leaves X.
- Chance and fare come from the data source and may be missing or stale. Confirm on IRCTC before paying.

## Tests

```bash
python3 -m unittest discover -s tests
```
