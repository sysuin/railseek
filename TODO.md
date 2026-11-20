# To do

## Needs checking by a person

- [ ] **Real alert notification.** On https://railseek.divkrsh.com, in Chrome or Edge (desktop or
  Android), choose Live data, search, open a result, tap **Alert me**, allow notifications, then press
  **Send a test notification**. One should appear within a few seconds. On iPhone, add railseek to
  the Home Screen first and test from the installed app. Only the local test, with a stand-in push
  service, has been run so far.
- [ ] **Alert timer firing on schedule.** The `railseek-alerts-timer` Worker should call
  `/api/alerts/run` every 15 minutes. Check its logs in the Cloudflare dashboard
  (Workers & Pages → railseek-alerts-timer → Logs) once an alert exists.
- [ ] **Install as an app on a phone**, and the offline view of the last search.
- [ ] **Share buttons** on a phone (share sheet) and on a desktop (WhatsApp).
- [ ] **Usage numbers.** Cloudflare Web Analytics is on (cookie-free). After a few days, look at
  Workers & Pages → railseek → Metrics → View Web Analytics to see visits and pages.

## Decisions waiting

- [ ] Make the GitHub repo private again later. The health-check workflow then needs GitHub billing
  fixed, since private repos pay for Actions minutes.

## Watch

- [ ] **Waitlist trend data.** History is saved only when someone searches, so trends start empty and
  fill up over days. Check after a week that booking sheets show "Moving" or "Getting longer" lines.
- [ ] **D1 usage.** Free D1 allows 100,000 row writes a day; history writes skip hours already saved.
  Check Storage & databases → D1 → railseek → Metrics if traffic grows.

## Backlog

- [ ] Hindi for the booking-sheet sentences written by the server (the page's own wording is done).
- [ ] Alerts by Telegram, for people who do not want browser notifications (needs a bot created
  from your Telegram account).
- [ ] Nearby dates, connections and nearby stations in the local command-line tool (site only today).
