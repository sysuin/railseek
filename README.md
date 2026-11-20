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
- Class chips in the train list are coloured by seat status for the visitor's own station pair
  (seats, RAC, waitlist, closed) with a short label, following the quota menu. The data comes with
  the train list, so it costs no extra requests.
- Stations can be typed by name or code. `site/public/stations.json` is built from the public
  DataMeet station list (mid-2010s) with a few renamed stations patched by hand; unknown codes are
  still accepted because the list is not complete.
- A search updates the address bar (`?from=SSM&to=NDLS&date=...`), and opening such a link runs it.
- Visitors can then tap a class on any train to check more station pairs; one such check spends at
  most 6 upstream requests. Answers are shared
  between visitors for 10 minutes, and each result shows how long ago its figure was saved.
- Each search also shows the best option on nearby dates (the day before to two days after) and up
  to five two-train journeys changing at a big junction on the route (for example DDU or Prayagraj),
  with a 1 to 8 hour wait. Tatkal figures only count once Tatkal is open for that date.
- "Start from a nearby station" lists trains from big junctions within about 150 km (straight
  line) that do not stop at your station; tapping one searches from there. Station coordinates come
  from `site/src/coords.js`, generated with `site/scripts/build_stations.py`.
- A passenger count (1 to 6) shows group totals, with notes on Tatkal's 4-passenger limit and on
  waitlists for groups. Results can be shared through the phone's share sheet or WhatsApp.
- The site installs as an app (`manifest.webmanifest`, `sw.js`). The service worker fetches fresh
  files first and falls back to saved copies offline, never caching search data; the page keeps the
  last live search in local storage and shows it when offline.
- A हिंदी / English switch translates the page's own wording (`public/i18n.js`). Station and train
  names, and the booking-sheet sentences written by the server, stay in English.
- The deeper check on one train also tries one two-ticket split on the same train (ported from the
  Python engine; the parity test covers it).
- Waitlist trend: each fresh ConfirmTkt answer saves general-quota figures to D1 (`history` table,
  one row per option per hour of ConfirmTkt's save time). The booking sheet shows how the waitlist
  has moved. Rows are removed the day after the journey.
- Cloudflare Web Analytics (cookie-free) is enabled on the Pages project; the security policy in
  `public/_headers` allows its beacon.
- Best options can be sorted (best chance, cheapest, leaves earliest) and filtered by departure time
  and AC or non-AC; the choice is remembered on the device. Recent routes appear as shortcuts.
- For journeys tomorrow, a banner counts down to Tatkal opening (10:00 AC, 11:00 non-AC) with a
  Tatkal checklist; for the day after, it notes that overnight trains open a day earlier.
- Hindi now also covers the booking sheet, key moments and checklists (patterns in `public/i18n.js`).
- Result rows show a plain status ("WL 2", "14 seats") with the waitlist type as a small note and
  the raw code on hover. Figures saved more than 12 hours ago are marked "may have changed" and rank
  a little lower. The best list shows one row per train and class.
- In the booking sheet, station codes show their names, and codes and numbers can be tapped to copy.
- "Change trains" measures each train's route to where it meets the destination city (a search to
  NDLS often returns trains ending at ANVT or DLI), with a distance-based fallback for picking hubs.
- Booking sheet extras: "Route and coaches" shows every stop with times, day, distance and expected
  platform (your stations highlighted), the published coach order and ConfirmTkt user ratings
  (`/api/route`, cached 7 days). "Add to calendar" downloads an .ics file with Tatkal opening, chart
  time and departure, each with a reminder; it works on iPhone without notifications.
- "Return trip" swaps the stations and moves the date two days on, ready to search.
- Caches and politeness counters use Cloudflare's Cache API, because free KV allows only 1,000
  writes a day. Those counters are per Cloudflare location, so the caps are approximate. KV is kept
  for the strict RapidAPI allowance.
- If ConfirmTkt fails and a `RAPIDAPI_KEY` secret exists, searches fall back to RapidAPI while its
  monthly allowance lasts.
- `/api/health` checks the data source (at most every 10 minutes). The GitHub Actions workflow in
  `.github/workflows/health.yml` calls it every 6 hours, so a broken source sends you an email.
- Alerts: "Alert me" in a booking sheet watches that train, class, quota, station pair and date.
  The browser gets a notification when the status improves (or seats disappear, or a waitlist moves
  a lot), 20 minutes before Tatkal opens, and when the first chart is due. Alerts end when the train
  leaves. How it works:
  - Alerts live in a D1 database (`migrations/`), not KV, because of KV's write limit.
  - Pushes carry no data (`src/push.js`, VAPID-signed); the service worker fetches its messages
    from `/api/alerts/inbox`. Only known browser push services are accepted as endpoints.
  - Pages cannot run on a timer, so `site/cron/` is a small Worker that calls `/api/alerts/run`
    every 15 minutes with the `RUN_KEY` secret. Each alert is checked about every 30 minutes.
  - Limits: 10 alerts per browser, 20 new alerts per visitor a day, 500 in all (`MAX_ALERTS`).
  - Secrets: `VAPID_PRIVATE_JWK` and `RUN_KEY` on the Pages project, `RUN_KEY` on the timer Worker.
    Deploy the timer with `npx wrangler deploy --config cron/wrangler.jsonc` from `site/`.
  - On iPhone, notifications work only from the installed app (Add to Home Screen).
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
