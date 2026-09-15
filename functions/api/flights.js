/**
 * Pages Functions fallback for /api/flights.
 * Primary path is worker.js (wrangler.toml). Same rules: ZK-TXA..TXF, 400 km,
 * callsign if available else reg, "on ground" — never arriving/leaving.
 */

const REGS = ["ZK-TXA", "ZK-TXB", "ZK-TXC", "ZK-TXD", "ZK-TXE", "ZK-TXF"];

const AIRPORTS = [
  { iata: "BNE", icao: "YBBN", name: "Brisbane", lat: -27.3842, lon: 153.1175 },
  { iata: "MEL", icao: "YMML", name: "Melbourne", lat: -37.6733, lon: 144.8433 },
  { iata: "SYD", icao: "YSSY", name: "Sydney", lat: -33.9461, lon: 151.1772 },
  { iata: "ADL", icao: "YPAD", name: "Adelaide", lat: -34.945, lon: 138.5306 },
  { iata: "PER", icao: "YPPH", name: "Perth", lat: -31.9403, lon: 115.9669 },
  { iata: "CNS", icao: "YBCS", name: "Cairns", lat: -16.8858, lon: 145.7553 },
  { iata: "DRW", icao: "YPDN", name: "Darwin", lat: -12.4147, lon: 130.8767 },
  { iata: "NLK", icao: "YSNF", name: "Norfolk Island", lat: -29.0416, lon: 167.9387 },
  { iata: "AKL", icao: "NZAA", name: "Auckland", lat: -37.0082, lon: 174.785 },
  { iata: "CHC", icao: "NZCH", name: "Christchurch", lat: -43.4894, lon: 172.532 },
  { iata: "PMR", icao: "NZPM", name: "Palmerston North", lat: -40.3206, lon: 175.617 },
  { iata: "LST", icao: "YMLT", name: "Launceston", lat: -41.5453, lon: 147.2144 },
];

const UA = "airport-forecast-board/2.0";
const RADIUS_KM = 400;

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = p2 - p1;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function fetchReg(reg) {
  const variants = [reg, reg.replace("-", "")];
  const bases = [
    (r) => `https://api.adsb.lol/v2/reg/${encodeURIComponent(r)}`,
    (r) => `https://opendata.adsb.fi/api/v2/reg/${encodeURIComponent(r)}`,
  ];
  for (const r of variants) {
    for (const make of bases) {
      try {
        const res = await fetch(make(r), { headers: { Accept: "application/json", "User-Agent": UA } });
        if (!res.ok) continue;
        const data = await res.json();
        const ac = data.ac || [];
        if (ac.length) return ac[0];
      } catch (_) {}
    }
  }
  return null;
}

function flightLabel(ac, reg) {
  const cs = (ac.flight || "").trim().toUpperCase().replace(/\s+/g, "");
  if (cs && /^[A-Z]{2,4}\d{1,4}[A-Z]?$/.test(cs)) return cs;
  if (cs && cs !== reg.replace("-", "") && !/^ZKTX[A-F]$/.test(cs)) return cs;
  return reg;
}

async function buildFlights() {
  const results = [];
  for (let i = 0; i < REGS.length; i += 3) {
    const batch = REGS.slice(i, i + 3);
    results.push(...(await Promise.all(batch.map((reg) => fetchReg(reg).then((ac) => ({ reg, ac }))))));
  }
  const byAirport = Object.fromEntries(AIRPORTS.map((a) => [a.iata, []]));
  const flights = [];
  for (const { reg, ac } of results) {
    if (!ac || ac.lat == null || ac.lon == null) continue;
    const onGround = ac.alt_baro === "ground" || ac.alt_baro === "GROUND";
    const callsign = flightLabel(ac, reg);
    for (const ap of AIRPORTS) {
      const km = haversineKm(ap.lat, ap.lon, ac.lat, ac.lon);
      if (km > RADIUS_KM) continue;
      const row = { reg, callsign, onGround, km: Math.round(km), airport: ap.iata };
      byAirport[ap.iata].push(row);
      flights.push(row);
    }
  }
  for (const k of Object.keys(byAirport)) byAirport[k].sort((a, b) => a.km - b.km);
  return { updated: new Date().toISOString(), radiusKm: RADIUS_KM, registrations: REGS, flights, byAirport };
}

export async function onRequest() {
  try {
    const data = await buildFlights();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
