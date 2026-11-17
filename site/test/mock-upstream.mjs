// Stand-in for the RapidAPI data source, for testing the live path in the real Workers runtime.
// node test/mock-upstream.mjs, then put UPSTREAM_BASE=http://127.0.0.1:8797 and RAPIDAPI_KEY=test in .dev.vars
import http from "node:http";
const trains = { status: true, data: [{ train_number: "12801", train_name: "Purushottam Express ", from_std: "14:58", to_sta: "03:50", from: "SSM", to: "ANVT", duration: "12:52", class_type: ["SL", "3A"] }] };
const sched = { data: { route: [["PURI", 1, 1315], ["GAYA", 2, 2260], ["SSM", 2, 2338], ["ANVT", 3, 0]].map(([c, day, m]) => ({ station_code: c, station_name: c, day, std_min: m, stop: true })) } };
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), name = u.pathname.split("/").pop();
  console.log(req.method, u.pathname, req.headers["x-rapidapi-key"] ? "key present" : "NO KEY");
  const d = u.searchParams.get("date");
  const body = name === "trainBetweenStations" ? trains : name === "getTrainSchedule" ? sched
    : { status: true, data: { availabilityClassList: [{ reservationClass: u.searchParams.get("classType"), charges: { totalFare: 1280 }, availabilities: [{ date: d, status: u.searchParams.get("fromStationCode") === "SSM" ? "RLWL67/WL23" : "GNWL12/WL4", prediction: 0.28 }] }] } };
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(body));
}).listen(8797, "127.0.0.1", () => console.log("mock upstream on 8797"));
