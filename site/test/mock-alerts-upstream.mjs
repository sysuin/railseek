// Stand-in for ConfirmTkt and a browser push service, for the local alerts test.
// GET /api/v1/trains/search|schedule like ConfirmTkt; POST /push/* like a push service.
// POST /set {status, pushStatus} changes the answers; GET /pushes lists pushes received.
import http from "node:http";
import { webcrypto as wc } from "node:crypto";
const PUB = process.argv[2];
let status = "REGRET", pushStatus = 201;
const pushes = [];
const b64u = s => Buffer.from(s, "base64url");
async function verifyVapid(auth, endpoint) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(auth || "");
  if (!m || m[2] !== PUB) return "bad header";
  const [h, c, s] = m[1].split(".");
  const key = await wc.subtle.importKey("raw", b64u(PUB), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await wc.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64u(s), new TextEncoder().encode(`${h}.${c}`));
  const claims = JSON.parse(b64u(c).toString());
  return ok && claims.aud === new URL(endpoint).origin && claims.exp > Date.now() / 1000 ? "valid" : "invalid";
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1"); let body = "";
  for await (const ch of req) body += ch;
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (u.pathname === "/set") { const b = JSON.parse(body || "{}"); status = b.status ?? status; pushStatus = b.pushStatus ?? pushStatus; return send(200, { status, pushStatus }); }
  if (u.pathname === "/pushes") return send(200, pushes);
  if (u.pathname.startsWith("/push/")) { pushes.push({ path: u.pathname, vapid: await verifyVapid(req.headers.authorization, `http://127.0.0.1:${req.socket.localPort}${u.pathname}`), ttl: req.headers.ttl, length: body.length }); res.writeHead(pushStatus); return res.end(); }
  if (u.pathname.endsWith("/schedule")) return send(200, { Schedule: [["PURI", 1, "21:55"], ["GAYA", 2, "13:40"], ["SSM", 2, "14:58"], ["ANVT", 3, ""]].map(([c, Day, t]) => ({ StationCode: c, StationName: c, Day, DepartureTime: t, ArrivalTime: t || "03:50" })) });
  if (u.pathname.endsWith("/search")) {
    const d = u.searchParams.get("dateOfJourney"), iso = `${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
    return send(200, { data: { trainList: [{ trainNumber: "12801", trainName: "PURUSHOTTAM SF", fromStnCode: u.searchParams.get("sourceStationCode"), toStnCode: "ANVT", departureTime: "14:58", arrivalTime: "03:50", duration: 772, avlClasses: ["3A"],
      availabilityCache: { "3A": { availability: status, predictionPercentage: 60, fare: "1280", date: `${iso}T00:00:00`, cacheTime: new Date(Date.now() + 19800000).toISOString().slice(0, 19) } }, availabilityCacheTatkal: {} }] } });
  }
  send(404, {});
}).listen(8796, "127.0.0.1", () => console.log("mock on 8796"));
