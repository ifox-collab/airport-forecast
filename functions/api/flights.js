/**
 * Cloudflare Worker: serves static board + /api/flights for ZK-TXA..TXF
 * Weather is fetched client-side every 5 minutes (saves free-tier compute).
 */

const REGS = ["ZK-TXA", "ZK-TXB", "ZK-TXC", "ZK-TXD", "ZK-TXE", "ZK-TXF"];

const AIRPORTS = [
  { iata: "BNE", icao: "YBBN", name: "Brisbane", lat: -27.3842, lon: 153.1170 },
  { iata: "MEL", icao: "YMML", name: "Melbourne", lat: -37.6733, lon: 144.8433 },
  { iata: "SYD", icao: "YSSY", name: "Sydney", lat: -33.9461, lon: 151.1772 },
  { iata: "ADL", icao: "YPAD", name: "Adelaide", lat: -34.9450, lon: 138.5306 },
  { iata: "PER", icao: "YPPH", name: "Perth", lat: -31.9403, lon: 115.9669 },
  { iata: "CNS", icao: "YBCS", name: "Cairns", lat: -16.8858, lon: 145.7553 },
  { iata: "DRW", icao: "YPDN", name: "Darwin", lat: -12.4147, lon: 130.8766 },
  { iata: "NLK", icao: "YSNF", name: "Norfolk Island", lat: -29.0417, lon: 167.9383 },
  { iata: "LST", icao: "YMLT", name: "Launceston", lat: -41.5453, lon: 147.2142 },
  { iata: "AKL", icao: "NZAA", name: "Auckland", lat: -37.0081, lon: 174.7920 },
  { iata: "CHC", icao: "NZCH", name: "Christchurch", lat: -43.4894, lon: 172.5320 },
  { iata: "PMR", icao: "NZPM", name: "Palmerston North", lat: -40.3206, lon: 175.6170 }
];

const RADIUS_KM = 200;
const RADIUS_NM = RADIUS_KM / 1.852; // ~108 nm

// In-isolate memory for distance trend (works between warm requests)
const prevPos = globalThis.__prevPos || (globalThis.__prevPos = new Map());

function nmDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function nearestAirport(lat, lon, maxNm = RADIUS_NM) {
  let best = null;
  let bestNm = 9999;
  for (const ap of AIRPORTS) {
    const nm = nmDistance(lat, lon, ap.lat, ap.lon);
    if (nm < bestNm) {
      bestNm = nm;
      best = ap;
    }
  }
  if (!best || bestNm > maxNm) return null;
  return { airport: best, nm: bestNm };
}

function formatAlt(alt) {
  if (alt === "ground" || alt === 0) return "GND";
  if (typeof alt !== "number" || !isFinite(alt)) return "—";
  if (alt >= 10000) return "FL" + Math.round(alt / 100);
  return Math.round(alt).toLocaleString("en-AU") + " ft";
}

function directionLabel(lat, lon, track, ap, nm, hex) {
  const key = hex || `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const now = Date.now();
  const prev = prevPos.get(key);
  prevPos.set(key, { lat, lon, nm, ap: ap.iata, t: now });

  // Prefer distance trend if we have a recent sample (30s–20 min)
  if (prev && prev.ap === ap.iata && now - prev.t > 30000 && now - prev.t < 20 * 60 * 1000) {
    const delta = nm - prev.nm;
    if (delta < -1.5) return "ARRIVING";
    if (delta > 1.5) return "LEAVING";
  }

  // Fallback: track vs bearing to airport
  if (typeof track === "number" && isFinite(track)) {
    const brgTo = bearingDeg(lat, lon, ap.lat, ap.lon);
    const brgFrom = (brgTo + 180) % 360;
    if (angleDiff(track, brgTo) <= 50) return "ARRIVING";
    if (angleDiff(track, brgFrom) <= 50) return "LEAVING";
  }

  if (nm < 3) return "AT FIELD";
  return "NEAR";
}

async function fetchReg(reg) {
  const variants = [reg, reg.replace("-", "")];
  const bases = [
    (r) => `https://opendata.adsb.fi/api/v2/reg/${encodeURIComponent(r)}`,
    (r) => `https://api.adsb.lol/v2/reg/${encodeURIComponent(r)}`
  ];
  for (const r of variants) {
    for (const make of bases) {
      try {
        const res = await fetch(make(r), {
          headers: { Accept: "application/json", "User-Agent": "airport-forecast-board/1.0" }
        });
        if (!res.ok) continue;
        const data = await res.json();
        const ac = data.ac || [];
        if (ac.length) return ac[0];
      } catch (_) {}
    }
  }
  return null;
}

async function buildFlights() {
  // Sequential-ish in small parallel batches to stay gentle
  const results = [];
  for (let i = 0; i < REGS.length; i += 3) {
    const batch = REGS.slice(i, i + 3);
    const got = await Promise.all(batch.map((reg) => fetchReg(reg).then((ac) => ({ reg, ac }))));
    results.push(...got);
  }

  const flights = [];
  for (const { reg, ac } of results) {
    if (!ac || ac.lat == null || ac.lon == null) continue;
    const near = nearestAirport(ac.lat, ac.lon, RADIUS_NM);
    if (!near) continue;

    const alt = ac.alt_baro;
    const track = typeof ac.track === "number" ? ac.track : ac.true_heading;
    const gs = typeof ac.gs === "number" ? ac.gs : null;
    const callsign = (ac.flight || "").trim() || reg;
    const dir = directionLabel(ac.lat, ac.lon, track, near.airport, near.nm, ac.hex || reg);

    flights.push({
      reg,
      callsign: callsign.replace(/\s+/g, ""),
      hex: ac.hex || null,
      type: ac.t || null,
      altitude: formatAlt(alt),
      alt_baro: alt,
      gs,
      track: track != null ? Math.round(track) : null,
      lat: ac.lat,
      lon: ac.lon,
      airport: near.airport.iata,
      airportName: near.airport.name,
      nm: Math.round(near.nm * 10) / 10,
      km: Math.round(near.nm * 1.852),
      direction: dir
    });
  }

  // Group by airport for the board
  const byAirport = {};
  for (const ap of AIRPORTS) byAirport[ap.iata] = [];
  for (const f of flights) {
    byAirport[f.airport].push(f);
  }
  for (const k of Object.keys(byAirport)) {
    byAirport[k].sort((a, b) => a.nm - b.nm);
  }

  return {
    updated: new Date().toISOString(),
    radiusKm: RADIUS_KM,
    registrations: REGS,
    flights,
    byAirport
  };
}

export async function onRequest(context) {
  try {
    const data = await buildFlights();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

