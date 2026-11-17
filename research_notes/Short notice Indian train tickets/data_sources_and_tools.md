# Data sources, APIs and existing software for a personal Indian Railways ticket-search assistant (status as of 17 Nov 2026)

Method note: all findings come from published pages and search-result summaries. No IRCTC endpoint was loaded, logged in to, or probed. Several primary pages could not be fetched (RapidAPI listing rendered empty; `mvp.railradar.in` did not resolve), so those items rest on secondary listings and are flagged. Where a fact was only seen in a search-result summary and not on the fetched page, it is marked "(search summary)".

## 1. Official routes: IRCTC B2B / PSP / partner programme, CRIS/NTES, data.gov.in, RailOne, any official open API

### Takeaway
There is no official open/public API for availability, fares or PNR; programmatic access to IRCTC reserved-ticketing data is contract-only (B2B Principal Service Provider / OTA integration) with historically reported integration fees in the tens of lakhs of rupees, which is out of reach for a personal tool. RailOne (CRIS, launched 1 July 2025) is a consumer app, not a developer API.

### Cited Findings
- IRCTC's B2B scheme is organised around "Principal Service Providers" (PSPs) who register their own Retail Service Providers; the tourism side says a separate Tourism Web-service API is given to B2B PSPs and that API integration for tourism packages is free. This page is about tourism packages, not rail availability. — [IRCTC Tourism: E-Ticketing PSPs](https://irctctourism.com/TravelAgents/InternetTicketingAgents.html) (search summary)
- A 2016-era B2B agreement filed with the US SEC (TripBorn) required a one-time non-refundable integration charge of Rs 50 lakh plus annual maintenance fees. Bespoke and old; not a current fee schedule. — [SEC EX-10.2](https://www.sec.gov/Archives/edgar/data/1498232/000121465916014705/ex10_2.htm) (search summary)
- An integrator quoted by Inc42 said "IRCTC charges used to be a flat INR 25 Lakh for almost every integration", and that a revised price structure for OTAs could raise servicing cost up to 10x. Article date not verified; revised figures not confirmed. — [Inc42](https://inc42.com/buzz/irctc-revises-price-structure-for-otas-servicing-cost-may-increase-by-10-times) (search summary)
- RailOne was launched on 1 July 2025 by the Railway Minister, developed by CRIS, consolidating services previously spread over IRCTC Rail Connect, UTS, NTES and Rail Madad; login is single sign-on via mPIN/biometric and accepts existing RailConnect and UTS credentials. Reserved bookings remain with IRCTC (RailOne is "authorised by IRCTC, like many other commercial apps"). — [Business Standard](https://www.business-standard.com/amp/india-news/railways-launches-railone-app-unifying-passenger-services-125070101292_1.html); [YourStory](https://yourstory.com/2025/07/indian-railways-super-app-railone-train-ticket-bookings); [Indian Infrastructure](https://indianinfrastructure.com/2025/07/03/indian-railways-launches-railone-app-developed-by-cris/) (search summaries)
- By Aug 2026 RailOne supported unreserved ("general") ticket booking from home with a 3% discount on digital payment. — [Business Today, 12 Aug 2026](https://www.businesstoday.in/india/story/no-more-queues-indian-railways-brings-general-tickets-to-your-phone-book-from-home-and-get-3-off-digitally-548772-2026-08-12) (search summary)
- A community MCP listing states plainly that Indian Railways publishes no free public API for availability, fares or delay history, and that ConfirmTkt and eRail are undocumented third-party endpoints. Secondary, but consistent with everything else found. — [getdrio listing of india-mcp-railways](https://www.getdrio.com/mcp/io-github-samarth-23-eng-india-mcp-railways/md) (search summary)
- data.gov.in: a 2015 DataMeet mailing-list post refers to an Open Government Data catalogue "indian-railways-train-time-table" with details for 2,810 trains. — [DataMeet group thread](https://groups.google.com/g/datameet/c/BcJ7V8-dVh0/m/ubf-ggB1AgAJ) (search summary)

### Inferences
- For a single-user personal assistant, the official B2B/PSP route is not realistic: it is designed for ticketing agents/OTAs, involves a commercial agreement, and the only fee figures found (Rs 25-50 lakh, dated) are prohibitive.
- The practical "official" surfaces for an individual are the consumer UIs (IRCTC web/Rail Connect, RailOne, NTES), used manually by the account holder.

### Gaps
- No current (2025-2026) official IRCTC document was found stating PSP/OTA API eligibility, fees, security deposit, or technical requirements. The IRCTC corporate PDFs surfaced (e.g. `irctc.com/index.php/download?id=10402`) were not opened.
- "SwaRail" (the name used for the superapp in beta before RailOne) did not appear in any result; its relationship to RailOne is unconfirmed from sources here.
- Whether the data.gov.in timetable catalogue is still downloadable and how recently it was refreshed was not verified.
- NTES/CRIS: no published developer terms or API were found; no source reviewed describes an official NTES API.

## 2. Third-party APIs (RapidAPI IRCTC listings, RailRadar, erail/ConfirmTkt-backed scrapers, Apify actors)

### Takeaway
All third-party "IRCTC APIs" are unofficial resellers/scrapers of consumer sites; they are the only low-cost programmatic source of availability, but pricing, rate limits and live-vs-cached behaviour of the main RapidAPI listing could not be verified from its page. RailRadar has clean documentation and a free key (100 requests/month) but covers schedules/live running only, not availability, fare or PNR.

### Cited Findings
- RapidAPI host `irctc1.p.rapidapi.com` is what community tools build on; one MCP server on it exposes search trains between stations, seat availability, availability across multiple dates, all-class check, PNR status and station-code lookup, and requires a RapidAPI key plus a subscription. Its README says a 403 means an expired subscription or exceeded rate limit, and describes availability as "real-time" (unverified claim by the wrapper author). — [kapurshitij/irctc-mcp](https://github.com/kapurshitij/irctc-mcp)
- RailRadar API: base `https://api.railradar.in/v1`, API key in `Authorization` header, free key with 100 requests/month; paid tiers and per-minute limits live on separate Pricing / Rate-limits pages (not retrieved). Endpoints: live train tracking, schedule, trains between stations, delay report, route geometry (GeoJSON), coach layout, platform coach position, cancellations/diversions, station live arrivals/departures, station timetable, journey planner, station/train search and full lists. No seat availability, fare or PNR endpoints are mentioned. — [RailRadar docs](https://railradar.in/docs)
- RailRadar data provenance: live positions are derived from anonymised GPS reports from on-board users, validated against route/speed/history; when no fresh report exists it returns a timetable-based estimate, with `isLive`, `trackingMode`, `lastUpdatedAt` flags. It states "Live positions are RailRadar estimates, not an official railway feed" and that it (a unit of Orthar Technologies) is not affiliated with Indian Railways, CRIS or IRCTC. — [RailRadar docs](https://railradar.in/docs)
- A RailRadar resource page advertised a JSON list of 13,334 Indian Railways trains. — [RailRadar train-names](https://mvp.railradar.in/resources/train-names) (search summary; host did not resolve when fetched on 17 Nov 2026)
- Apify actor "Indian Railways Timetable Scraper" returns full routes and per-stop timings by scraping erail.in for schedules/fares and runningstatus.in for live status. — [Apify actor](https://apify.com/jungle_synthesizer/indian-railways-timetable-scraper.md) (search summary)
- Another Apify actor, "IRCTC Train Data Scraper" (scrapingshark), exists with its own pricing page. — [Apify](https://apify.com/scrapingshark/irctc-train-data-scraper/pricing) (not opened)
- `s4tyendra/railway-api` (created Oct 2023, last pushed Nov 2023) scrapes ConfirmTkt and opens its README with a warning pointing to ConfirmTkt's terms and conditions. — [ecosyste.ms listing](https://awesome.ecosyste.ms/projects/github.com%2Fs4tyendra%2Frailway-api) (search summary)
- Zyla API Hub also lists IRCTC-themed marketplace APIs. — [Zyla](https://www.zylalabs.com/api-marketplace/top-search/IRCTC) (not opened)
- Legal backdrop: Section 143 of the Railways Act covers unauthorised carrying on of the business of procuring and supplying railway tickets, with punishment reported as up to three years. The developer of the "Super Tatkal"/"Super Tatkal Pro" apps (an IIT Kharagpur graduate) was arrested by the RPF, the apps were deactivated, and officials said he had no IRCTC permission and was acting like a ticketing agent; he was bailed about a week later. — [The News Minute](https://www.thenewsminute.com/amp/story/tamil-nadu/ready-help-irctc-improve-booking-system-says-tn-techie-arrested-making-app-138513); [Inc42](https://inc42.com/buzz/iit-grads-faster-rail-ticket-booking-app-puts-him-behind-bars) (search summaries)
- A CBI assistant programmer was arrested for developing and selling Tatkal software to agents. — [Scroll](https://scroll.in/latest/862953/scroll_in) (search summary)

### Inferences
- The reported enforcement cases involve booking/procuring tickets for others or selling booking software, not read-only availability lookups for oneself. Read-only use of third-party APIs is mainly a terms-of-service and reliability risk; anything that automates booking moves toward Section 143 and IRCTC account-ban territory. This is an inference, not legal advice.
- Because RapidAPI-style providers themselves scrape consumer sites behind anti-bot protection, outages and silent staleness should be expected; a design should treat every availability figure as "as of timestamp X" and re-confirm on IRCTC before acting.
- A sensible split: RailRadar or a static dataset for route/stop enumeration (cheap, stable), and a paid availability API only for the final station-pair queries (expensive, rate-limited).

### Gaps
- RapidAPI IRCTC1 (publisher shown as IRCTCAPI / "JERC" in one README): endpoint list, plan prices, free-tier quota, rate limits, and whether availability is live or cached could not be read (page returned no content). Must be checked manually on the Pricing tab.
- indianrailapi.com, railwayapi.com/RailwayAPI, railkit, and Trainman/ixigo unofficial endpoints: no current sources found; status unknown. (RailwayAPI and indianrailapi have a history of going paid/offline, but no citable source was retrieved in this session.)
- No independent reliability/uptime reports (Reddit, HN) were retrieved for any provider.
- No source was found that states the text of IRCTC's website terms regarding scraping/automated access, nor any court ruling specifically on read-only scraping of rail data in India.

## 3. How the IRCTC web app serves availability; anti-bot measures (high level)

### Takeaway
IRCTC's next-generation site has allowed train search and availability viewing without login since 2018, but whether that is still true in 2026 was not confirmed; the platform is now heavily defended (Akamai bot management, CAPTCHA, Aadhaar-authenticated accounts and Aadhaar OTP for Tatkal, mass account deactivation), so unattended automation against it is both fragile and risky.

### Cited Findings
- The 2018 relaunch let users "enquire/search trains and check availability of seats without login" and added waitlist-confirmation probability. — [Business Standard / IANS, May 2018](https://business-standard.com/amp/article/news-ians/now-check-trains-seat-availability-without-logging-into-irctc-website-118053001097_1.html); [DeshGujarat](https://www.deshgujarat.com/2018/05/30/beta-version-of-new-irctc-e-ticketing-website-launched-now-search-trains-and-check-availability-of-seats-without-login/) (search summaries)
- A RailMitra guide instead describes logging in with user ID, password and captcha before the availability step (undated; conflicts with the above). — [RailMitra](https://www.railmitra.com/blog/irctc-seat-avalilability-in-train) (search summary)
- From 1 July 2025, Tatkal tickets can be booked on the IRCTC website/app only by Aadhaar-authenticated users. — [Deccan Herald](https://www.deccanherald.com/amp/story/india%2Frailways-to-mandate-e-aadhaar-for-tatkal-tickets-3572082) (search summary)
- Aadhaar OTP for Tatkal was extended in phases: as of 4 Dec 2025 it was active on 322 trains online and 211 trains at reservation counters. — [Free Press Journal](https://www.freepressjournal.in/tech/aadhaar-otp-boosts-tatkal-fairness-irctc-blocks-302-cr-fake-ids-availability-jumps-65) (search summary)
- The Railway Minister told Parliament that 3.02 crore suspicious IRCTC user IDs were deactivated since January 2025 (2.5 crore reported mid-2025), and that anti-bot solutions "such as AKAMAI" are deployed to filter non-genuine users. — [Millennium Post](https://www.millenniumpost.in/big-stories/irctc-deactivates-302-cr-suspicious-user-ids-in-less-than-12-months-639567); [Business Standard, Jul 2025](https://www.business-standard.com/india-news/irctc-blocks-25-million-user-ids-reason-ticket-fraud-prevention-125072600601_1.html) (search summaries)
- Government-sourced claims: bot traffic was up to 50% of login attempts in the opening minutes of Tatkal; between July and December 2025 the portal saw 9,753 crore hits of which 6,265 crore were flagged suspicious and denied. No independent audit. — [newkerala](https://www.newkerala.com/news/a/train-tickets-over-crore-suspicious-user-ids-deactivated-303.htm); [Kerala Kaumudi](https://keralakaumudi.com/en/news/news-amp.php?id=1715404) (search summaries)
- A Dec 2025 report says verification/re-verification of all IRCTC customer accounts was completed. — [BizzBuzz](https://www.bizzbuzz.news/national/irctc-accounts-under-scanner-over-3-crore-ids-deactivated-as-railways-tighten-ticket-booking-rules-1381416) (search summary)
- Factly has a summary of the checks put in place against Tatkal misuse. — [Factly](https://factly.in/these-are-the-checks-put-in-place-to-prevent-misuse-of-tatkal-booking/amp) (not opened)

### Inferences
- With roughly two-thirds of hits being denied as suspicious by IRCTC's own account, a personal script hitting IRCTC directly is likely to be blocked, and tying it to a real Aadhaar-verified account risks that account. Reading availability via a third party and doing the booking by hand in the official UI is the lower-risk architecture.
- Aadhaar OTP at booking time means a fully unattended Tatkal booking is no longer possible even in principle; a human must receive and enter the OTP.

### Gaps
- Not confirmed for 2026: whether availability is viewable without login on irctc.co.in, what CAPTCHA type is in use at login/booking, and any published session/rate rules (e.g. per-user search limits, single-session rule, agent time restrictions in the first minutes of ARP/Tatkal). No technical write-up of the nget front-end's request flow was retrieved.
- Device-fingerprinting specifics are not documented in any source found; only the generic "Akamai anti-bot" statement is citable.

## 4. Static datasets: station codes and train schedules with stop sequences

### Takeaway
Free schedule data with full stop sequences exists (DataMeet CC0 JSON, an Indian Railways GTFS feed on Mobility Database, RailRadar lists), but the well-known open dumps are old and undated; freshness must be validated before using them to enumerate station pairs.

### Cited Findings
- `datameet/railways`: three files, `stations.json` (GeoJSON points with `code`, `name`, `state`, `zone`, `address`), `trains.json` (GeoJSON LineStrings with number, name, type, zone, from/to station, departure/arrival, duration, distance, class flags) and `schedules.json` (one object per train stop: `train_number`, `station_code`, `day`, `arrival`, `departure`). Licence CC0. Gathered by Sanjay Bhangar and Sajjad Anwar over several months. Only 3 commits; no data date or row counts given on the repo page. — [datameet/railways](https://github.com/datameet/railways)
- `anandology/railways` uses the same one-row-per-stop schedule model. — [anandology/railways](https://github.com/anandology/railways) (search summary)
- Mobility Database lists an "Indian Railways" GTFS Schedule feed with 10,503 routes. — [Mobility Database mdb-2867](https://mobilitydatabase.org/feeds/gtfs/mdb-2867) (search summary; publisher and feed date not checked)
- RailRadar offers full station and train list endpoints and per-train schedule (`/v1/trains/{number}`), compiled from "a compiled railway dataset"; a resource page cited 13,334 trains. — [RailRadar docs](https://railradar.in/docs); [train-names resource](https://mvp.railradar.in/resources/train-names) (latter via search summary)
- data.gov.in timetable catalogue was reported in 2015 to cover 2,810 trains. — [DataMeet thread](https://groups.google.com/g/datameet/c/BcJ7V8-dVh0/m/ubf-ggB1AgAJ) (search summary)

### Inferences
- For route enumeration the stop sequence of a specific train on a specific date is what matters; a per-train schedule call (RailRadar free tier, or the schedule endpoint of a RapidAPI provider) at query time is safer than trusting a static dump, with a static dump used only for station-name/code autocomplete.
- A train with N stops has N(N-1)/2 ordered pairs; with a 100-requests/month free tier, enumeration must be pruned (e.g. only earlier-boarding/later-alighting pairs around the user's actual segment, and quota-boundary stations).

### Gaps
- Data vintage of the DataMeet dump (believed mid-2010s) and of the GTFS feed was not confirmed. Kaggle datasets were not surveyed.
- No source found that lists which stations are remote-location / pooled-quota boundaries per train, which is the key input for smart station-pair pruning.

## 5. Existing consumer features: split-station alternates, prediction, guarantees

### Takeaway
ixigo and ConfirmTkt (same group) already ship "Same Train Alternates", which searches the same train from stations before the source or after the destination to find a confirmed seat; "guarantee" products are paid refund-multiplier insurance on waitlisted tickets, not a way to obtain seats. Implementation details of prediction models are not published in the sources found.

### Cited Findings
- ixigo "Same Train Alternates" (article dated 4 Apr 2025): on a waitlisted train, the feature shows options labelled "CNF Seat" by checking stations "before the source station or after the destination station" on the same train; example given is a Jaipur passenger for whom a seat is found from Ajmer. It is presented as one booking; no mention of splitting into two tickets, class/quota changes, or fare difference. — [ixigo travel story](https://www.ixigo.com/ixigo-same-train-alternates-get-confirmed-tickets-story-1174078)
- ConfirmTkt has a help article "How to check Same Train Alternate in ConfirmTkt" (video only, no written mechanism). — [ConfirmTkt help](https://confirmtkthelp.freshdesk.com/support/solutions/articles/44002326171-how-to-check-same-train-alternate-in-confirmtkt) (search summary)
- IRCTC's own site has shown a waitlist-confirmation probability since the 2018 relaunch. — [Governance Now](https://www.governancenow.com/news/regular-story/irctc-unveils-new-portal-with-waitlist-prediction-feature) (search summary)
- ixigo Travel Guarantee: for trains, 1x refund to original payment mode plus 1x as a Travel Guarantee coupon (2x total) for bookings after 9 Jan 2025, payout depending on the alternate travel mode chosen at claim. — [ixigo alternate travel](https://www.ixigo.com/trains/alternate-travel) (search summary)
- ConfirmTkt's equivalent is now branded "Alternate Travel Plan (formerly Travel Guarantee)". — [ConfirmTkt](https://www.confirmtkt.com/alternate-travel-plan) (search summary)
- MakeMyTrip Trip Guarantee: paid opt-in; older terms describe a 3x refund (fare via IRCTC plus the rest as voucher) capped at Rs 6,000 when the ticket is still waitlisted at chart preparation; partially confirmed/RAC tickets are not eligible. Terms may have changed. — [MakeMyTrip policy page](https://promos.makemytrip.com/train-fc-policy.html); [The CSR Journal guide](https://thecsrjournal.in/how-get-confirmed-train-ticket-waitlisted-routes-using-mmts-trip-guarantee-alternate-trains) (search summaries)
- ixigo launched its guarantee feature to compete with MMT's. — [Entrackr](https://entrackr.com/news/ixigo-takes-on-mmt-with-trip-guarantee-feature-for-train-travelers-8451051) (search summary)
- A third-party site, gapseat.in, markets itself as a train seat availability checker. — [gapseat.in](https://gapseat.in/) (not opened; function unverified)

### Inferences
- The core idea of a multi-station search (extend the booked segment outward on the same train to cross a quota boundary) is already productised by licensed IRCTC partners with first-party API access. A personal tool adds value mainly through customisation: user-specific station sets, combining with different trains/dates/classes, two-ticket splits, and persistent alerts, rather than the basic idea.
- Because the extended ticket is one booking from an earlier station, the passenger pays the longer fare and must handle boarding-point rules; the sources do not discuss this.

### Gaps
- No technical source on how ConfirmTkt/ixigo/Trainman build prediction models (features, training data) or how many station pairs "alternates" scans.
- RailYatri, Trainman, redRail, Paytm, Amazon train features: nothing retrieved in this session.
- No source confirming any consumer app offers a true two-ticket split (A to X plus X to B on the same train) search.

## 6. Existing automation tools: IRCTC Master List, Tatkal autofill extensions, open-source bots/CLIs

### Takeaway
Tatkal autofill browser extensions are still plentiful and being updated on the Chrome Web Store in 2026, mostly positioning themselves as "form fill only, no CAPTCHA bypass"; older open-source Selenium bots are deprecated or predate the 2025 Aadhaar-OTP/Akamai changes. No evidence was found of store takedowns in 2025-2026, but history shows developers of booking-acceleration apps have been arrested.

### Cited Findings
- Chrome Web Store listings present in 2026 include: Quick Book AutoFill, FlickTrain, TatkalMate, IRCTC Fast Ticket Booker, IRCTC Tatkal Autofill Assistant, Jhatkal - Tatkal helper for IRCTC, IRCTC Quick Tatkal. — [Quick Book AutoFill](https://chromewebstore.google.com/detail/quick-book-autofill/knndcegmilobcbdhgibafbnlaolgekhn); [FlickTrain](https://chromewebstore.google.com/detail/flicktrain/godlhmbcknpkjmnbbeeenghbibohmbcg); [TatkalMate](https://chromewebstore.google.com/detail/tatkalmate/ieemdocdclbcdhhflhkaaekbbbcbnipn); [IRCTC Fast Ticket Booker](https://chromewebstore.google.com/detail/irctc-fast-ticket-booker/fmbodhmoimogpgihmkfepgjleceojaeh); [IRCTC Tatkal Autofill Assistant](https://chromewebstore.google.com/detail/hgiefnnhpkoikmpbdbehpacopdefjnag); [Jhatkal](https://chromewebstore.google.com/detail/ckeejafimbnlkinphhdfobjjfgbflnne) (search results; individual listings not opened)
- Some listings show recent updates (one "Updated January 23, 2026", another version 2.1.1 dated 12 Jun 2026), and several self-describe as not bypassing CAPTCHAs, not manipulating queues and not using bots. These are developer claims. — [Chrome Web Store / extension trackers](https://extpose.com/ext/518329) (search summary; which date belongs to which extension not verified)
- A GitHub gist documents a subscription-status flaw in one paid Tatkal extension, indicating these are often paid, closed-source products with their own trust issues. — [gist by krushna06](https://gist.github.com//krushna06/2599ded645998bd9cda651387054ba41) (search summary)
- ixigo publishes its own "ixiTrainFill (IRCTC Autofill)" explainer. — [ixigo](https://www.ixigo.com/trains/irctc-tatkal-autofill) (not opened)
- Firefox add-on "AutoMotor - IRCTC Auto Fill (New & Old Website)" by YTCorp states it is not affiliated with or endorsed by IRCTC. — [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/automotor/) (search summary)
- Open-source: `YadavGulshan/irctc` (Selenium, Python) is marked deprecated and last pushed over three years ago; it derives from an older `avamsi` gist for semi-automated Tatkal booking. `arunpatala/captcha.irctc` (2016) claimed 98% accuracy reading the then IRCTC CAPTCHA with deep learning. `SuneetPatil/IRCTC-tatkal-booking` uses UiPath RPA. — [YadavGulshan/irctc listing](https://repos.ecosyste.ms/hosts/GitHub/repositories/YadavGulshan%2Firctc); [avamsi gist](https://gist.github.com/avamsi/6172da9a46f3c9b8c163); [captcha.irctc listing](https://awesome.ecosyste.ms/projects/github.com%2Farunpatala%2Fcaptcha.irctc); [SuneetPatil repo](https://github.com/SuneetPatil/IRCTC-tatkal-booking) (search summaries)
- Enforcement precedent: Super Tatkal / Super Tatkal Pro apps were deactivated and the developer arrested under the Railways Act; separately, around 100 "panel developers and software sellers" were reported arrested in a crackdown on illegal ticketing software. — [The News Minute](https://www.thenewsminute.com/amp/story/tamil-nadu/ready-help-irctc-improve-booking-system-says-tn-techie-arrested-making-app-138513); [DT Next](https://www.dtnext.in/news/national/railway-sleuths-bust-ticketing-racket-powered-by-pakistani-software) (search summaries; attribution of the "100 arrested" figure to a specific article not verified)
- Proxy-vendor blogs (GoProxy, Swiftproxy) publish "how to automate IRCTC booking" guides while conceding CAPTCHA and OTP mandates still apply. Commercially motivated; low reliability. — [GoProxy](https://www.goproxy.com/blog/how-to-automate-irctc-ticket-booking) (search summary)

### Inferences
- The surviving, tolerated niche is client-side form autofill on the user's own logged-in session, with the human solving CAPTCHA and entering the Aadhaar OTP. Anything headless, multi-account, or CAPTCHA-solving is what the 2025 measures target.
- For a personal assistant, the safest "booking assist" is to prepare everything (train, class, quota, boarding station, passenger list via IRCTC's own saved Master List) and hand off to the user in the official UI.

### Gaps
- IRCTC's own Master List / saved-passenger feature and any official statement on third-party autofill extensions: no source retrieved.
- Named tools in the brief ("Tatkal Now", "Quick Tatkal", MagicAutoFill successors, "IRCTC Tatkal Automation"): current working status and any takedown history not established. No 2025-2026 report of Chrome Web Store removals or IRCTC explicitly blocking extensions was found (absence of evidence only).
- No recent (2025-2026) open-source Playwright/Puppeteer Tatkal bot or IRCTC CLI client was verified as working; GitHub was not searched directly.

## 7. Notification channels practical in India

### Takeaway
Not researched in this session; no cited findings.

### Cited Findings
- None retrieved.

### Inferences
- From general knowledge (uncited): a Telegram bot is the usual zero-cost choice for personal alerts; WhatsApp requires the Business API with template approval and per-message fees; email and mobile push (e.g. via ntfy/Pushover-style services) are simple fallbacks. Treat as unverified.

### Gaps
- No sources gathered on WhatsApp Business API pricing in India, DLT/SMS registration requirements, or Telegram reliability. Needs a separate short pass if the report depends on it.

## 8. LLM-agent / MCP-based train assistants (2025-2026)

### Takeaway
IRCTC's own AskDISHA 2.0 (CoRover, launched around May 2025) does conversational/voice booking inside IRCTC's site and app; outside that, at least half a dozen community MCP servers expose Indian Railways lookups (search, availability, PNR, live status) but all sit on unofficial upstreams, are small hobby projects, and none performs booking.

### Cited Findings
- AskDISHA 2.0, built with CoRover.ai, was covered from late May 2025: supports ticket booking, cancellation, refund status, PNR status, change of boarding station, booking history and ERS download by text or voice in English, Hindi, Hinglish and Gujarati; available as a chat icon on the IRCTC website and Rail Connect app; reports say booking is possible by OTP without the IRCTC password. — [Business Today, 29 May 2025](https://www.businesstoday.in/personal-finance/news/story/irctc-askdisha-2-ai-assistant-train-ticket-booking-refund-cancellation-478255-2025-05-29); [Business Standard](https://www.business-standard.com/finance/personal-finance/askdisha-2-0-book-cancel-track-train-refunds-with-irctc-s-new-ai-125053000593_1.html); [Zee Business](https://zeebiz.com/indian-railways/news-irctc-train-ticket-booking-no-more-password-required-just-ask-disha-20-to-book-your-berth-how-it-works-201727); [CoRover](https://corover.ai/askdisha) (search summaries)
- `amith-vp/indian-railway-mcp`: hosted remote MCP (author-run endpoint, connected via `mcp-remote`) with 8 tools: search-trains, get-seat-availability, get-train-info, get-train-live-status, get-train-delay-info, get-live-station-info, get-station-code, get-train-code. 28 stars, 14 commits, sample outputs dated April 2025; upstream data source not disclosed; no licence visible. — [GitHub](https://github.com/amith-vp/indian-railway-mcp)
- `kapurshitij/irctc-mcp`: local Python MCP wrapping RapidAPI `irctc1.p.rapidapi.com`; tools search_trains, check_seat_availability, check_availability_multiple_dates, check_all_classes, get_pnr_status, get_station_code; needs own RapidAPI key; MIT; single commit, 0 stars. — [GitHub](https://github.com/kapurshitij/irctc-mcp)
- `rajprem4214/indian-railways-mcp`: 5 tools (station live status, trains between stations, trains on date, train route, PNR status); last commit 14 Apr 2025; upstream described only as "Indian Railways APIs". — [listing](https://thedailyworkflow.com/mcp/server/indian-railways-mcp)
- Other listed servers: `Shadhai/Railway_mcp` (Python, stdio; schedules, live status, PNR, fares, seat data), `shubhamyadav8901/railways-mcp` (remote, Docker), `Samarth-23-eng/India-MCP` (npm; trains, stations, schedules, live status), `lpkumarreddy/railway-mcp-scheduler`. — [Glama: Railway_mcp](https://glama.ai/mcp/servers/Shadhai/Railway_mcp); [getdrio: india-mcp-railways](https://www.getdrio.com/mcp/io-github-samarth-23-eng-india-mcp-railways/md); [LobeHub listing](https://lobehub.com/mcp/kapurshitij-irctc-mcp) (search summaries)
- "irctc.dev - Indian Railways API platform" appears as an indie project on Peerlist. — [Peerlist](https://peerlist.io/manjotsi620026/project/irctcdev--indian-railways-api-platform) (not opened)

### Inferences
- The MCP projects demonstrate the feasible personal architecture: an LLM front end plus read-only lookup tools over a third-party API. None implements multi-station-pair sweep or alerts, so that remains a gap a personal tool could fill.
- Using someone else's hosted MCP endpoint adds a second unofficial dependency; wrapping a paid API with one's own key (as `kapurshitij/irctc-mcp` does) is easier to reason about.

### Gaps
- No 2026 updates found on AskDISHA (e.g. integration with RailOne) or on ixigo/ConfirmTkt/MakeMyTrip LLM assistants.
- None of the MCP repos were checked for current working status in Nov 2026; most visible activity dates are April 2025.
