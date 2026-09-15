/**
 * Cloudflare Worker: static board + /api/weather + /api/flights
 * ZK-TXA..TXF within 400 km. Official AWC METAR/TAF with NOAA METAR backup.
 */

const REGS = ["ZK-TXA", "ZK-TXB", "ZK-TXC", "ZK-TXD", "ZK-TXE", "ZK-TXF"];

const AIRPORTS = [
  { iata: "BNE", icao: "YBBN", name: "Brisbane", lat: -27.3842, lon: 153.1175, tz: "Australia/Brisbane", runways: [{ ident: "01/19", heading: 14 }] },
  { iata: "MEL", icao: "YMML", name: "Melbourne", lat: -37.6733, lon: 144.8433, tz: "Australia/Melbourne", runways: [{ ident: "09/27", heading: 94 }, { ident: "16/34", heading: 159 }] },
  { iata: "SYD", icao: "YSSY", name: "Sydney", lat: -33.9461, lon: 151.1772, tz: "Australia/Sydney", runways: [{ ident: "07/25", heading: 74 }, { ident: "16/34", heading: 155 }] },
  { iata: "ADL", icao: "YPAD", name: "Adelaide", lat: -34.945, lon: 138.5306, tz: "Australia/Adelaide", runways: [{ ident: "05/23", heading: 48 }] },
  { iata: "PER", icao: "YPPH", name: "Perth", lat: -31.9403, lon: 115.9669, tz: "Australia/Perth", runways: [{ ident: "03/21", heading: 21 }, { ident: "06/24", heading: 57 }] },
  { iata: "CNS", icao: "YBCS", name: "Cairns", lat: -16.8858, lon: 145.7553, tz: "Australia/Brisbane", runways: [{ ident: "15/33", heading: 146 }] },
  { iata: "DRW", icao: "YPDN", name: "Darwin", lat: -12.4147, lon: 130.8767, tz: "Australia/Darwin", runways: [{ ident: "11/29", heading: 114 }] },
  { iata: "NLK", icao: "YSNF", name: "Norfolk Island", lat: -29.0416, lon: 167.9387, tz: "Pacific/Norfolk", runways: [{ ident: "04/22", heading: 29 }] },
  { iata: "AKL", icao: "NZAA", name: "Auckland", lat: -37.0082, lon: 174.785, tz: "Pacific/Auckland", runways: [{ ident: "05/23", heading: 51 }] },
  { iata: "CHC", icao: "NZCH", name: "Christchurch", lat: -43.4894, lon: 172.532, tz: "Pacific/Auckland", runways: [{ ident: "02/20", heading: 20 }] },
  { iata: "PMR", icao: "NZPM", name: "Palmerston North", lat: -40.3206, lon: 175.617, tz: "Pacific/Auckland", runways: [{ ident: "07/25", heading: 73 }] },
  { iata: "LST", icao: "YMLT", name: "Launceston", lat: -41.5453, lon: 147.2144, tz: "Australia/Hobart", runways: [{ ident: "14/32", heading: 137 }] },
];

const ICAO_LIST = AIRPORTS.map((a) => a.icao).join(",");
const UA = "airport-forecast-board/2.0";
const RADIUS_KM = 400;

function json(data, status = 200, maxAge = 60) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

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

function visToMeters(visib) {
  if (visib == null || visib === "") return null;
  if (typeof visib === "number") {
    if (!Number.isFinite(visib)) return null;
    if (visib > 50) return Math.round(visib);
    return Math.round(visib * 1609.34);
  }
  const s = String(visib).trim().toUpperCase();
  if (s === "CAVOK" || s.includes("9999")) return 10000;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (s.length === 4 && n >= 100) return n;
  if (n > 50) return Math.round(n);
  return Math.round(n * 1609.34);
}

function ceilingFeet(clouds) {
  if (!clouds?.length) return null;
  const bases = clouds
    .filter((c) => ["BKN", "OVC", "VV"].includes(String(c.cover || "").toUpperCase()))
    .map((c) => c.base)
    .filter((b) => b != null);
  return bases.length ? Math.min(...bases) : null;
}

function classifyWx(wx) {
  const u = (wx || "").toUpperCase();
  if (!u || u === "NSW") return "clear";
  if (u.includes("TS") || u.includes("SQ") || u.includes("GR")) return "storm";
  if (/\+RA|\+SHRA/.test(u)) return "heavy-rain";
  if (u.includes("RA") || u.includes("SH") || u.includes("DZ")) return "rain";
  if (u.includes("FG")) return "fog";
  if (u.includes("BR") || u.includes("HZ")) return "mist";
  return "cloud";
}

function parseCloudsFromRaw(raw) {
  if (!raw) return [];
  const u = raw.toUpperCase();
  if (u.includes("CAVOK")) return [{ cover: "NSC", base: null }];
  const layers = [];
  const re = /\b(FEW|SCT|BKN|OVC|VV|NSC|NCD|CLR|SKC)(\d{3})?\b/g;
  let m;
  while ((m = re.exec(u))) layers.push({ cover: m[1], base: m[2] ? Number(m[2]) * 100 : null });
  return layers;
}

function parseGust(raw) {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/\b(?:VRB|\d{3})\d{2,3}G(\d{2,3})KT\b/);
  return m ? Number(m[1]) : null;
}

function condFromFcst(fcst) {
  const clouds = (fcst.clouds || []).map((c) => ({ cover: (c.cover || "").toUpperCase(), base: c.base ?? null }));
  const visM = visToMeters(fcst.visib ?? null);
  const wx = fcst.wxString && fcst.wxString !== "NSW" ? fcst.wxString : null;
  const cavok = String(fcst.visib || "").toUpperCase() === "CAVOK" || visM >= 9999 && clouds.every((c) => ["NSC", "NCD", "CLR", "SKC", ""].includes(c.cover));
  return {
    windDir: fcst.wdir ?? null,
    windKt: fcst.wspd ?? null,
    gustKt: fcst.wgst ?? null,
    visM,
    ceilingFt: ceilingFeet(clouds),
    wx,
    wxKind: classifyWx(wx),
    clouds,
    cavok,
    tempC: null,
    dewC: null,
  };
}

function alertLevel(c, extra = {}) {
  const wind = Math.max(c.windKt || 0, c.gustKt || 0);
  const vis = c.visM;
  const ceil = c.ceilingFt;
  const kind = c.wxKind;
  const fog = kind === "fog" || extra.fog;
  if ((vis != null && vis < 1000) || wind >= 35 || (ceil != null && ceil < 300) || kind === "storm" || kind === "heavy-rain" || (fog && (vis == null || vis < 1500))) return "red";
  if ((vis != null && vis < 3000) || wind >= 25 || (ceil != null && ceil < 1000) || kind === "rain" || kind === "mist" || kind === "fog" || (extra.prob >= 30 && (kind === "rain" || kind === "fog" || kind === "mist"))) return "amber";
  return "none";
}

function worse(a, b) {
  const r = { none: 0, amber: 1, red: 2 };
  return r[a] >= r[b] ? a : b;
}

function localParts(date, tz) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), hour: get("hour"), minute: get("minute") };
}

function utcHHmm(date) {
  return String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0");
}

function nextSlots(tz, count, from) {
  const slots = [];
  const start = new Date(from);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(start.getUTCHours() - 6);
  for (let i = 0; i < 96 && slots.length < count; i++) {
    const t = new Date(start.getTime() + i * 3600 * 1000);
    const lp = localParts(t, tz);
    if (Number(lp.minute) !== 0 || Number(lp.hour) % 3 !== 0) continue;
    if (t.getTime() + 3 * 3600 * 1000 <= from.getTime()) continue;
    slots.push(t);
  }
  return slots.slice(0, count);
}

function pickPrevailing(fcsts, atMs) {
  const base = fcsts.filter((f) => {
    const change = (f.fcstChange || "").toUpperCase();
    return change !== "TEMPO" && (f.probability == null || f.probability === 0);
  });
  const hits = base.filter((f) => (f.timeFrom || 0) * 1000 <= atMs && atMs < (f.timeTo || 0) * 1000);
  return hits.at(-1) || null;
}

function overlapping(f, startMs, endMs) {
  return (f.timeFrom || 0) * 1000 < endMs && (f.timeTo || 0) * 1000 > startMs;
}

function emptyCond() {
  return { windDir: null, windKt: null, gustKt: null, visM: null, ceilingFt: null, wx: null, wxKind: "clear", clouds: [], cavok: false, tempC: null, dewC: null };
}

function metarOf(row) {
  if (!row) {
    return { raw: null, fltCat: null, windDir: null, windKt: null, gustKt: null, visM: null, ceilingFt: null, wx: null, wxKind: "cloud", tempC: null, dewC: null, clouds: [], ageMin: null };
  }
  const clouds = (row.clouds && row.clouds.length ? row.clouds.map((c) => ({ cover: (c.cover || "").toUpperCase(), base: c.base ?? null })) : parseCloudsFromRaw(row.rawOb));
  const visM = visToMeters(row.visib ?? null);
  const wx = row.wxString && row.wxString !== "//" ? row.wxString : null;
  let ageMin = null;
  if (row.reportTime) ageMin = Math.max(0, Math.round((Date.now() - new Date(row.reportTime).getTime()) / 60000));
  return {
    raw: row.rawOb || null,
    fltCat: row.fltCat || null,
    windDir: row.wdir ?? null,
    windKt: row.wspd ?? null,
    gustKt: row.wgst ?? parseGust(row.rawOb),
    visM,
    ceilingFt: ceilingFeet(clouds),
    wx,
    wxKind: classifyWx(wx),
    tempC: row.temp ?? null,
    dewC: row.dewp ?? null,
    clouds,
    ageMin,
    cavok: String(row.rawOb || "").includes("CAVOK") || ((visM || 0) >= 9999 && clouds.every((c) => ["NSC", "NCD", "CLR", "SKC", ""].includes(c.cover))),
  };
}

function parseRawMetar(text) {
  const lines = text.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
  const rawLine = lines.find((l) => /\b[A-Z]{4}\s+\d{6}Z\b/.test(l.replace(/^(METAR|SPECI)\s+/, ""))) || lines.at(-1);
  if (!rawLine) return null;
  const raw = rawLine.replace(/^(METAR|SPECI)\s+/, "").replace(/\s+/g, " ").trim();
  const icao = raw.slice(0, 4);
  const timeM = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  let reportTime = null;
  if (timeM) {
    const now = new Date();
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Number(timeM[1]), Number(timeM[2]), Number(timeM[3]), 0));
    reportTime = dt.toISOString();
  }
  const windM = raw.match(/\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  const visTok = raw.includes("CAVOK") ? "9999" : (raw.match(/\b(\d{4})\b/) || [])[1] || null;
  const tempM = raw.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  const toC = (s) => (s ? Number(s.replace("M", "-")) : null);
  return {
    icaoId: icao,
    rawOb: raw,
    reportTime,
    temp: toC(tempM && tempM[1]),
    dewp: toC(tempM && tempM[2]),
    wdir: windM ? (windM[1] === "VRB" ? "VRB" : Number(windM[1])) : null,
    wspd: windM ? Number(windM[2]) : null,
    wgst: windM && windM[3] ? Number(windM[3]) : null,
    visib: visTok,
    wxString: null,
    clouds: parseCloudsFromRaw(raw),
  };
}

async function fetchNoaaMetar(icao) {
  try {
    const res = await fetch(`https://tgftp.nws.noaa.gov/data/observations/metar/stations/${icao}.TXT`, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return parseRawMetar(await res.text());
  } catch (_) {
    return null;
  }
}

function buildSlots(airport, taf, now) {
  const fcsts = taf?.fcsts || [];
  return nextSlots(airport.tz, 10, now).map((start) => {
    const end = new Date(start.getTime() + 3 * 3600 * 1000);
    const mid = new Date(start.getTime() + 90 * 60 * 1000);
    const prevFcst = pickPrevailing(fcsts, mid.getTime());
    const prevailing = prevFcst ? condFromFcst(prevFcst) : emptyCond();
    const tempoFcsts = fcsts.filter((f) => (f.fcstChange || "").toUpperCase() === "TEMPO" && overlapping(f, start.getTime(), end.getTime()));
    const probFcsts = fcsts.filter((f) => f.probability && f.probability >= 30 && overlapping(f, start.getTime(), end.getTime()));
    const tempo = tempoFcsts[0] ? condFromFcst(tempoFcsts[0]) : null;
    const topProb = probFcsts.sort((a, b) => (b.probability || 0) - (a.probability || 0))[0];
    const probCond = topProb ? condFromFcst(topProb) : null;
    let alert = alertLevel(prevailing);
    if (tempo) alert = worse(alert, alertLevel(tempo, { fog: tempo.wxKind === "fog" }));
    if (topProb) alert = worse(alert, alertLevel(probCond, { prob: topProb.probability, fog: probCond.wxKind === "fog" }));
    const lp = localParts(start, airport.tz);
    return {
      startIso: start.toISOString(),
      localLabel: `${lp.weekday} ${lp.hour}:${lp.minute}`,
      utcLabel: `${utcHHmm(start)}Z`,
      prevailing,
      tempo,
      prob: topProb?.probability ?? null,
      probWx: topProb?.wxString && topProb.wxString !== "NSW" ? topProb.wxString : null,
      probCond,
      alert,
    };
  });
}

async function attachMetNo(cond, lat, lon, at) {
  try {
    const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return cond;
    const json = await res.json();
    const series = json.properties?.timeseries || [];
    let best = null;
    let bestDiff = Infinity;
    const t = at.getTime();
    for (const s of series) {
      const d = Math.abs(new Date(s.time).getTime() - t);
      if (d < bestDiff) {
        bestDiff = d;
        best = s;
      }
    }
    if (!best || bestDiff > 4 * 3600 * 1000) return cond;
    const d = best.data.instant.details;
    return { ...cond, tempC: d.air_temperature ?? cond.tempC, dewC: d.dew_point_temperature ?? cond.dewC };
  } catch (_) {
    return cond;
  }
}

async function buildWeather() {
  const warnings = [];
  let metars = [];
  let tafs = [];
  let tafDown = false;
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/metar?ids=${ICAO_LIST}&format=json`, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (res.ok) metars = await res.json();
    else warnings.push("Primary METAR unavailable");
  } catch (_) {
    warnings.push("Primary METAR unavailable");
  }
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/taf?ids=${ICAO_LIST}&format=json`, { headers: { Accept: "application/json", "User-Agent": UA } });
    if (res.ok) tafs = await res.json();
    else tafDown = true;
  } catch (_) {
    tafDown = true;
  }
  if (tafDown) warnings.push("TAF down — retrying every 2 min");
  if (!metars.length) {
    const backups = await Promise.all(AIRPORTS.map((a) => fetchNoaaMetar(a.icao)));
    metars = backups.filter(Boolean);
    if (metars.length) warnings.push("METAR from NOAA backup");
  }

  const metarBy = new Map(metars.map((m) => [m.icaoId, m]));
  const tafBy = new Map(tafs.map((t) => [t.icaoId, t]));
  const now = new Date();

  const airports = [];
  for (const a of AIRPORTS) {
    const taf = tafBy.get(a.icao);
    const airportTafDown = tafDown || !(taf?.fcsts?.length);
    const slots = buildSlots(a, airportTafDown ? null : taf, now);
    const sample = emptyCond();
    const filled = await attachMetNo(sample, a.lat, a.lon, now);
    for (const slot of slots) {
      slot.prevailing.tempC = filled.tempC;
      slot.prevailing.dewC = filled.dewC;
      if (slot.tempo) {
        slot.tempo.tempC = filled.tempC;
        slot.tempo.dewC = filled.dewC;
      }
    }
    const metar = metarOf(metarBy.get(a.icao));
    let rowAlert = metar.fltCat === "LIFR" || metar.fltCat === "IFR" ? "red" : metar.fltCat === "MVFR" ? "amber" : "none";
    for (const s of slots.slice(0, 4)) rowAlert = worse(rowAlert, s.alert);
    airports.push({
      iata: a.iata,
      icao: a.icao,
      name: a.name,
      tz: a.tz,
      runways: a.runways,
      metar,
      tafDown: airportTafDown,
      slots,
      rowAlert,
    });
  }
  return { fetchedAt: now.toISOString(), warnings, tafDown, airports };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/flights" || url.pathname === "/api/flights/") {
      try {
        return json(await buildFlights());
      } catch (e) {
        return json({ error: String(e.message || e) }, 500, 10);
      }
    }
    if (url.pathname === "/api/weather" || url.pathname === "/api/weather/") {
      try {
        return json(await buildWeather(), 200, 90);
      } catch (e) {
        return json({ error: String(e.message || e), tafDown: true }, 500, 10);
      }
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
