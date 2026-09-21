const AIRPORTS = [
  { iata: "BNE", icao: "YBBN", name: "Brisbane", lat: -27.3842, lon: 153.1175, tz: "Australia/Brisbane", runways: [{ ident: "01/19", heading: 14 }] },
  { iata: "MEL", icao: "YMML", name: "Melbourne", lat: -37.6733, lon: 144.8433, tz: "Australia/Melbourne", runways: [{ ident: "09/27", heading: 94 }, { ident: "16/34", heading: 159 }] },
  { iata: "SYD", icao: "YSSY", name: "Sydney", lat: -33.9461, lon: 151.1772, tz: "Australia/Sydney", runways: [{ ident: "07/25", heading: 74 }, { ident: "16/34", heading: 155 }] },
  { iata: "ADL", icao: "YPAD", name: "Adelaide", lat: -34.945, lon: 138.5306, tz: "Australia/Adelaide", runways: [{ ident: "05/23", heading: 48 }] },
  { iata: "PER", icao: "YPPH", name: "Perth", lat: -31.9403, lon: 115.9669, tz: "Australia/Perth", runways: [{ ident: "03/21", heading: 21 }, { ident: "06/24", heading: 57 }] },
  { iata: "CNS", icao: "YBCS", name: "Cairns", lat: -16.8858, lon: 145.7553, tz: "Australia/Brisbane", runways: [{ ident: "15/33", heading: 146 }] },
  { iata: "DRW", icao: "YPDN", name: "Darwin", lat: -12.4147, lon: 130.8767, tz: "Australia/Darwin", runways: [{ ident: "11/29", heading: 114 }] },
  { iata: "NLK", icao: "YSNF", name: "Norfolk Island", lat: -29.0416, lon: 167.9387, tz: "Pacific/Norfolk", runways: [{ ident: "04/22", heading: 29 }] },
  { iata: "LST", icao: "YMLT", name: "Launceston", lat: -41.5453, lon: 147.2144, tz: "Australia/Hobart", runways: [{ ident: "14/32", heading: 137 }] },
  { iata: "AKL", icao: "NZAA", name: "Auckland", lat: -37.0082, lon: 174.785, tz: "Pacific/Auckland", runways: [{ ident: "05/23", heading: 51 }] },
  { iata: "CHC", icao: "NZCH", name: "Christchurch", lat: -43.4894, lon: 172.532, tz: "Pacific/Auckland", runways: [{ ident: "02/20", heading: 20 }] },
  { iata: "PMR", icao: "NZPM", name: "Palmerston North", lat: -40.3206, lon: 175.617, tz: "Pacific/Auckland", runways: [{ ident: "07/25", heading: 73 }] }
];
const CARD = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const CACHE_KEY = "afb-rose-v1";
function cardinal(deg) {
  if (deg == null) return "VRB";
  if (typeof deg === "string" && /VRB|N\/A/i.test(deg)) return "VRB";
  const n = Number(deg);
  if (!Number.isFinite(n)) return "VRB";
  return CARD[Math.round(((n % 360) + 360) % 360 / 22.5) % 16];
}
function formatVis(m) {
  if (m == null) return "\u2014";
  if (m >= 9999) return "10km+";
  if (m >= 5000) return Math.round(m / 1000) + "km+";
  if (m >= 1000) { const km = Math.round((m / 1000) * 10) / 10; return (Number.isInteger(km) ? km : km.toFixed(1)) + "km"; }
  return Math.round(m) + "m";
}
function formatClouds(clouds, cavok) {
  if (cavok) return "NIL SIG";
  const layers = (clouds || []).filter((c) => (c.cover || "").length);
  if (!layers.length) return "NIL SIG";
  return layers.map((c) => {
    const cover = String(c.cover || "").toUpperCase();
    if (cover === "NSC") return "NIL SIG";
    if (cover === "NCD") return "No Clouds";
    if (c.base == null || ["CLR", "SKC"].includes(cover)) return cover;
    return cover + " " + c.base + "ft";
  }).join(" ");
}
function formatCeiling(ft, cavok) { return (cavok || ft == null) ? "None" : ft + "ft"; }
function formatWind(kt, dir) { return kt == null ? "Wind \u2014" : "Wind " + Math.round(kt) + " kt " + cardinal(dir); }
function decodeWx(wx) {
  if (!wx) return "";
  const u = String(wx).toUpperCase().replace(/\s+/g, "");
  if (!u || u === "NSW" || u === "//") return "";
  const map = { TSRA: "thunderstorm rain", TS: "thunderstorm", SHRA: "showers", SH: "showers", RA: "rain", DZ: "drizzle", FG: "fog", BR: "mist", HZ: "haze", SN: "snow", GR: "hail" };
  let s = u, prefix = "";
  if (s.startsWith("+")) { prefix = "Heavy "; s = s.slice(1); }
  else if (s.startsWith("-")) { prefix = "Light "; s = s.slice(1); }
  const hit = Object.keys(map).find((k) => s.includes(k));
  const out = hit ? (prefix + map[hit]).trim() : wx;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
function padRw(h) { let n = Math.round(h / 10) % 36; if (n === 0) n = 36; return String(n).padStart(2, "0"); }
function alignmentDelta(a, b) { const d = Math.abs((((a - b) % 180) + 180) % 180); return d > 90 ? 180 - d : d; }
function uniqueRunways(runways) {
  const out = [];
  for (const rw of runways || []) {
    if (out.some((kept) => alignmentDelta(kept.heading, rw.heading) < 20)) continue;
    out.push(rw);
  }
  return out;
}
function windRose(runways, dir, kt, compact) {
  const cx = 100, cy = 100, ticks = [];
  for (let a = 0; a < 360; a += 10) {
    const rad = (a - 90) * Math.PI / 180;
    const inner = a % 90 === 0 ? 78 : 84;
    ticks.push('<line x1="'+(cx+Math.cos(rad)*inner)+'" y1="'+(cy+Math.sin(rad)*inner)+'" x2="'+(cx+Math.cos(rad)*96)+'" y2="'+(cy+Math.sin(rad)*96)+'" stroke="#9fb4c8" stroke-width="'+(a%90===0?2:1)+'" />');
  }
  const labs = [["N",100,18],["E",186,104],["S",100,190],["W",14,104]];
  const extra = [[30,158,32],[60,176,56],[120,176,148],[150,158,172],[210,42,172],[240,24,148],[300,24,56],[330,42,32]];
  const labels = labs.map(([t,x,y]) => '<text x="'+x+'" y="'+y+'" text-anchor="middle" fill="#e8eef6" font-size="12" font-weight="700">'+t+'</text>').join("")
    + extra.map(([t,x,y]) => '<text x="'+x+'" y="'+y+'" text-anchor="middle" fill="#8b9bb4" font-size="9">'+String(t).padStart(2,"0")+'</text>').join("");
  const rws = uniqueRunways(runways).map((rw) => {
    const parts = (rw.ident || "").split("/");
    return '<g transform="rotate('+rw.heading+' '+cx+' '+cy+')"><rect x="92" y="31" width="16" height="138" rx="2" fill="#3d4f63" stroke="#9fb4c8" /><text x="100" y="44" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">'+(parts[0]||padRw(rw.heading))+'</text><text x="100" y="162" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">'+(parts[1]||padRw(rw.heading+180))+'</text></g>';
  }).join("");
  const numDir = (dir == null || dir === "VRB") ? null : Number(dir);
  const arrow = (numDir == null || !Number.isFinite(numDir)) ? "" : (
    '<g transform="rotate('+numDir+' '+cx+' '+cy+')">'
    + '<line class="wind-track" x1="'+cx+'" y1="'+(cy-88)+'" x2="'+cx+'" y2="'+(cy+88)+'" />'
    + '<g class="wind-arrow"><path d="M '+cx+' '+(cy-10)+' L '+(cx-11)+' '+(cy-32)+' L '+(cx-4)+' '+(cy-32)+' L '+(cx-4)+' '+(cy-52)+' L '+(cx+4)+' '+(cy-52)+' L '+(cx+4)+' '+(cy-32)+' L '+(cx+11)+' '+(cy-32)+' Z" fill="#4ade80" stroke="#166534" /></g>'
    + '</g>'
  );
  const pill = (!compact && numDir != null && kt != null) ? '<div class="pill">'+Math.round(numDir)+'\u00b0 '+Math.round(kt)+' kt</div>' : "";
  return '<div class="rose '+(compact?"sm":"")+'"><svg viewBox="0 0 200 200">'+ticks.join("")+labels+rws+arrow+'</svg>'+pill+'</div>';
}
function hot(on) { return on ? "hot" : "fg"; }
function strong(kt) { return kt != null && kt >= 35; }
function parseCloudsFromRaw(raw) {
  if (!raw) return [];
  const u = raw.toUpperCase();
  if (u.includes("CAVOK")) return [{ cover: "NSC", base: null }];
  const layers = []; const re = /\b(FEW|SCT|BKN|OVC|VV|NSC|NCD|CLR|SKC)(\d{3})?\b/g; let m;
  while ((m = re.exec(u))) layers.push({ cover: m[1], base: m[2] ? Number(m[2]) * 100 : null });
  return layers;
}
function ceilingFeet(clouds) {
  const bases = (clouds || []).filter((c) => ["BKN","OVC","VV"].includes(String(c.cover||"").toUpperCase())).map((c) => c.base).filter((b) => b != null);
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
function parseRawMetar(text) {
  if (!text) return null;
  const raw = String(text).replace(/^(METAR|SPECI)\s+/, "").replace(/\s+/g, " ").trim();
  const windM = raw.match(/\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  const visTok = raw.includes("CAVOK") ? "9999" : ((raw.match(/\b(\d{4})\b/) || [])[1] || null);
  const tempM = raw.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  const toC = (s) => (s ? Number(s.replace("M", "-")) : null);
  const wxM = raw.match(/\s(\+|-)?(VC)?(TS|SH|DZ|RA|SN|FG|BR|HZ|GR)+[A-Z]*\b/);
  const timeM = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  let ageMin = null;
  if (timeM) {
    const now = new Date();
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Number(timeM[1]), Number(timeM[2]), Number(timeM[3]), 0));
    if (dt.getTime() > now.getTime()) dt.setUTCMonth(dt.getUTCMonth() - 1);
    ageMin = Math.max(0, Math.round((now.getTime() - dt.getTime()) / 60000));
  }
  const clouds = parseCloudsFromRaw(raw);
  return {
    raw,
    windDir: windM ? (windM[1] === "VRB" ? "VRB" : Number(windM[1])) : null,
    windKt: windM ? Number(windM[2]) : null,
    gustKt: windM && windM[3] ? Number(windM[3]) : null,
    visM: visTok ? Number(visTok) : null,
    clouds, ceilingFt: ceilingFeet(clouds),
    tempC: toC(tempM && tempM[1]), dewC: toC(tempM && tempM[2]),
    wx: wxM ? wxM[0].trim() : null, wxKind: classifyWx(wxM ? wxM[0] : ""),
    cavok: raw.includes("CAVOK"), ageMin, model: false
  };
}
function fltCatOf(c) {
  const vis = c.visM, ceil = c.ceilingFt;
  if ((vis != null && vis < 1600) || (ceil != null && ceil < 500)) return "LIFR";
  if ((vis != null && vis < 5000) || (ceil != null && ceil < 1000)) return "IFR";
  if ((vis != null && vis < 8000) || (ceil != null && ceil < 3000)) return "MVFR";
  if (vis != null || ceil != null || c.cavok || c.raw) return "VFR";
  return "";
}
function alertLevel(c) {
  const wind = Math.max(c.windKt || 0, c.gustKt || 0);
  const vis = c.visM, ceil = c.ceilingFt, kind = c.wxKind;
  if ((vis != null && vis < 1000) || wind >= 35 || (ceil != null && ceil < 300) || kind === "storm" || kind === "heavy-rain" || kind === "fog") return "red";
  if ((vis != null && vis < 3000) || wind >= 25 || (ceil != null && ceil < 1000) || kind === "rain" || kind === "mist") return "amber";
  return "none";
}
function worse(a, b) { const r = { none: 0, amber: 1, red: 2 }; return (r[a] || 0) >= (r[b] || 0) ? a : b; }
function localParts(date, tz) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
  return { weekday: get("weekday"), hour: get("hour"), minute: get("minute") };
}
function utcHHmm(date) { return String(date.getUTCHours()).padStart(2,"0") + ":" + String(date.getUTCMinutes()).padStart(2,"0"); }
function nextSlots(tz, count, from) {
  const slots = []; const start = new Date(from);
  start.setUTCSeconds(0, 0); start.setUTCMinutes(start.getUTCMinutes() - (start.getUTCMinutes() % 30)); start.setUTCHours(start.getUTCHours() - 6);
  for (let i = 0; i < 200 && slots.length < count; i++) {
    const t = new Date(start.getTime() + i * 30 * 60 * 1000);
    const lp = localParts(t, tz);
    if (Number(lp.minute) !== 0 || Number(lp.hour) % 3 !== 0) continue;
    if (t.getTime() + 3 * 3600 * 1000 <= from.getTime()) continue;
    slots.push(t);
  }
  return slots.slice(0, count);
}
function wxFromCode(code) {
  if (code == null) return { wx: null, kind: "clear" };
  if (code === 45 || code === 48) return { wx: "FG", kind: "fog" };
  if (code >= 95) return { wx: "TSRA", kind: "storm" };
  if (code === 65 || code === 82) return { wx: "+RA", kind: "heavy-rain" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { wx: code >= 80 ? "SHRA" : "RA", kind: "rain" };
  if (code >= 51 && code <= 57) return { wx: "DZ", kind: "rain" };
  return { wx: null, kind: "clear" };
}
function condFromHourly(h, i) {
  const vis = h.visibility ? h.visibility[i] : null;
  const coverPct = h.cloud_cover ? h.cloud_cover[i] : null;
  const lowPct = h.cloud_cover_low ? h.cloud_cover_low[i] : coverPct;
  const cover = coverPct == null ? "NSC" : coverPct < 10 ? "NSC" : coverPct < 31 ? "FEW" : coverPct < 56 ? "SCT" : coverPct < 88 ? "BKN" : "OVC";
  const lowCover = lowPct == null ? cover : lowPct < 10 ? "NSC" : lowPct < 31 ? "FEW" : lowPct < 56 ? "SCT" : lowPct < 88 ? "BKN" : "OVC";
  const overcast = ["BKN","OVC"].includes(lowCover);
  const wxc = wxFromCode(h.weather_code ? h.weather_code[i] : null);
  return {
    windDir: h.wind_direction_10m ? h.wind_direction_10m[i] : null,
    windKt: h.wind_speed_10m ? h.wind_speed_10m[i] : null,
    gustKt: h.wind_gusts_10m ? h.wind_gusts_10m[i] : null,
    visM: typeof vis === "number" ? vis : null,
    ceilingFt: wxc.kind === "fog" ? 200 : overcast ? 2000 : null,
    wx: wxc.wx, wxKind: wxc.kind,
    clouds: [{ cover, base: cover === "NSC" ? null : overcast ? 2000 : 3500 }],
    cavok: (vis == null || vis >= 9999) && !wxc.wx && ["NSC","FEW","SCT"].includes(cover),
    tempC: h.temperature_2m ? h.temperature_2m[i] : null,
    dewC: h.dew_point_2m ? h.dew_point_2m[i] : null
  };
}
function nearestHourIndex(times, atMs) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < times.length; i++) { const d = Math.abs(new Date(times[i]).getTime() - atMs); if (d < bestD) { bestD = d; best = i; } }
  return best;
}
async function fetchMetar(icao) {
  try {
    const res = await fetch("https://rotatepilot.com/api/v1/metar?icao=" + icao + "&taf=1");
    if (res.ok) {
      const data = await res.json();
      const raw = data.raw || data.rawOb || data.metar || "";
      if (raw) {
        const parsed = parseRawMetar(raw);
        if (parsed) {
          parsed.tafRaw = data.tafRaw || data.taf || data.rawTaf || "";
          if (typeof parsed.tafRaw === "object" && parsed.tafRaw) parsed.tafRaw = parsed.tafRaw.raw || parsed.tafRaw.text || "";
          return parsed;
        }
      }
    }
  } catch (_) {}
  try {
    const res = await fetch("https://metar.vatsim.net/" + icao);
    if (res.ok) { const raw = (await res.text()).trim(); if (raw.length > 10) return parseRawMetar(raw); }
  } catch (_) {}
  return null;
}
async function fetchForecasts() {
  const out = new Array(AIRPORTS.length);
  for (let i = 0; i < AIRPORTS.length; i += 4) {
    const batch = AIRPORTS.slice(i, i + 4);
    const params = new URLSearchParams({ latitude: batch.map((a) => a.lat).join(","), longitude: batch.map((a) => a.lon).join(","), hourly: "temperature_2m,dew_point_2m,weather_code,cloud_cover,cloud_cover_low,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m", wind_speed_unit: "kn", timezone: "auto", forecast_days: "3" });
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt) await new Promise((r) => setTimeout(r, 700 * attempt));
        const res = await fetch("https://api.open-meteo.com/v1/forecast?" + params);
        if (res.status === 429) continue;
        if (!res.ok) throw new Error("om");
        data = await res.json(); break;
      } catch (_) {}
    }
    const arr = data ? (Array.isArray(data) ? data : [data]) : batch.map(() => null);
    arr.forEach((d, j) => { out[i + j] = d; });
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i] && out[i].hourly) continue;
    try {
      const ap = AIRPORTS[i];
      const res = await fetch("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + ap.lat + "&lon=" + ap.lon, { headers: { "User-Agent": "airport-forecast-board/2.0" } });
      if (res.ok) out[i] = { _metno: await res.json() };
    } catch (_) {}
  }
  return out;
}
function slotsFromForecast(ap, fc, now) {
  const times = nextSlots(ap.tz, 10, now);
  if (fc && fc.hourly && fc.hourly.time) {
    return times.map((start) => {
      const prevailing = condFromHourly(fc.hourly, nearestHourIndex(fc.hourly.time, start.getTime() + 90*60*1000));
      const lp = localParts(start, ap.tz);
      return { localLabel: lp.weekday + " " + lp.hour + ":" + lp.minute, utcLabel: utcHHmm(start) + "Z", prevailing, tempo: null, alert: alertLevel(prevailing) };
    });
  }
  const ts = (((fc || {})._metno || {}).properties || {}).timeseries || [];
  return times.map((start) => {
    let best = null, bestD = Infinity;
    for (const pt of ts) { const d = Math.abs(new Date(pt.time).getTime() - start.getTime()); if (d < bestD) { bestD = d; best = pt; } }
    const det = best && best.data && best.data.instant ? (best.data.instant.details || {}) : {};
    const symbol = String(((((best || {}).data || {}).next_1_hours || {}).summary || {}).symbol_code || "");
    let wx = null, kind = "clear", visM = 10000;
    if (symbol.includes("fog")) { wx = "FG"; kind = "fog"; visM = 600; }
    else if (symbol.includes("thunder")) { wx = "TSRA"; kind = "storm"; visM = 3000; }
    else if (symbol.includes("rain")) { wx = "RA"; kind = "rain"; visM = 5000; }
    const spd = det.wind_speed != null ? det.wind_speed * 1.94384 : null;
    const coverPct = det.cloud_area_fraction;
    const cover = coverPct == null ? "NSC" : coverPct < 31 ? "FEW" : coverPct < 56 ? "SCT" : coverPct < 88 ? "BKN" : "OVC";
    const prevailing = { windDir: det.wind_from_direction != null ? Math.round(det.wind_from_direction) : null, windKt: spd != null ? Math.round(spd) : null, gustKt: null, visM, ceilingFt: kind === "fog" ? 200 : ["BKN","OVC"].includes(cover) ? 2000 : null, wx, wxKind: kind, clouds: [{ cover, base: cover === "NSC" ? null : 2500 }], cavok: !wx && cover !== "OVC", tempC: det.air_temperature != null ? Math.round(det.air_temperature) : null, dewC: null };
    const lp = localParts(start, ap.tz);
    return { localLabel: lp.weekday + " " + lp.hour + ":" + lp.minute, utcLabel: utcHHmm(start) + "Z", prevailing, tempo: null, alert: alertLevel(prevailing) };
  });
}
function clockHtml(tz, id) { return '<p class="clock" data-tz="'+tz+'" id="'+id+'">--:--:--<span>(--:--:-- UTC)</span></p>'; }
function tickClocks() {
  const now = new Date();
  document.querySelectorAll(".clock[data-tz]").forEach((el) => {
    const tz = el.getAttribute("data-tz");
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
    el.innerHTML = get("hour")+":"+get("minute")+":"+get("second")+"<span>("+now.toISOString().slice(11,19)+" UTC)</span>";
  });
}
function renderAirport(a) {
  const m = a.metar || {}, cavok = !!m.cavok, wxWords = decodeWx(m.wx);
  const showGust = m.gustKt != null && m.windKt != null && m.gustKt > m.windKt;
  const boxes = (a.slots || []).map((s) => {
    const c = s.prevailing || {};
    const showG = c.gustKt != null && c.windKt != null && c.gustKt > c.windKt;
    const fog = c.wxKind === "fog";
    return '<article class="box '+(s.alert||"none")+'"><div class="box-head"><span>'+s.localLabel+'</span><span class="z">('+s.utcLabel+')</span></div>'
      + windRose(a.runways, c.windDir, c.windKt, true)
      + '<div class="grid"><div><span class="fg">Vis </span>'+formatVis(c.visM)+'</div><div><span class="fg">Temp </span>'+(c.tempC!=null?Math.round(c.tempC)+"\u00b0":"\u2014")+'</div>'
      + '<div><span class="fg">Clouds </span>'+formatClouds(c.clouds,c.cavok)+'</div><div><span class="fg">Dew </span>'+(c.dewC!=null?Math.round(c.dewC)+"\u00b0":"\u2014")+'</div>'
      + '<div><span class="fg">Ceiling </span>'+formatCeiling(c.ceilingFt,c.cavok)+'</div>'
      + '<div><div class="'+hot(strong(c.windKt))+'">'+formatWind(c.windKt,c.windDir)+'</div>'+(showG?'<div class="'+hot(strong(c.gustKt))+'">Gusting '+Math.round(c.gustKt)+' kt</div>':'')+'</div>'
      + (c.wx?'<div style="grid-column:1/-1"><span class="fg">Weather </span>'+decodeWx(c.wx)+'</div>':'')+'</div>'
      + (fog?'<p class="warn">Fog warning</p>':'')+'</article>';
  }).join("");
  return '<section class="row '+(a.rowAlert||"none")+'"><div class="row-head"><p class="name">'+a.iata+' <span class="icao">'+a.icao+'</span> '+a.name+'</p>'
    + clockHtml(a.tz,"clk-"+a.icao)+(m.fltCat?'<span class="badge '+m.fltCat+'">'+m.fltCat+'</span>':'')
    + (m.model?'<span class="age">No METAR \u00b7 model</span>':(m.ageMin!=null?'<span class="age '+(m.ageMin>=60?'stale':'')+'">METAR '+m.ageMin+' min ago</span>':''))+'</div>'
    + '<div class="body"><div class="now">'+windRose(a.runways,m.windDir,m.windKt,false)
    + '<div class="grid" style="margin-top:8px;font-size:14px"><div><div class="'+hot(strong(m.windKt))+'">'+formatWind(m.windKt,m.windDir)+'</div>'
    + (showGust?'<div class="'+hot(strong(m.gustKt))+'">Gusting '+Math.round(m.gustKt)+' kt</div>':'')
    + '<div><span class="fg">Vis </span>'+formatVis(m.visM)+'</div><div><span class="fg">Clouds </span>'+formatClouds(m.clouds,cavok)+'</div>'
    + (wxWords?'<div><span class="fg">Weather </span>'+wxWords+'</div>':'')+'</div><div>'
    + '<div><span class="fg">Ceiling </span>'+formatCeiling(m.ceilingFt,cavok)+'</div>'
    + '<div><span class="fg">Temp </span>'+(m.tempC!=null?Math.round(m.tempC)+"\u00b0":"\u2014")+'</div>'
    + '<div><span class="fg">Dew </span>'+(m.dewC!=null?Math.round(m.dewC)+"\u00b0":"\u2014")+'</div></div></div></div>'
    + '<div class="boxes">'+boxes+'</div></div>'
    + (m.raw?'<p class="raw">'+m.raw+(m.tafRaw?' \u00b7 '+String(m.tafRaw):'')+'</p>':'')+'</section>';
}
let weather = null, offset = 0, pausedUntil = 0;
function paint() {
  const airports = (weather && weather.airports) || [];
  document.getElementById("track").innerHTML = '<div class="pad" id="first">'+airports.map(renderAirport).join('')+'</div><div class="pad" aria-hidden="true">'+airports.map(renderAirport).join('')+'</div>';
  const t = new Date();
  document.getElementById("updated").textContent = "Updated "+String(t.getUTCHours()).padStart(2,"0")+":"+String(t.getUTCMinutes()).padStart(2,"0")+" UTC \u00b7 weather in browser \u00b7 no ADS-B";
  tickClocks();
}
async function load() {
  const banner = document.getElementById("banner");
  try {
    const [metars, forecasts] = await Promise.all([Promise.all(AIRPORTS.map((a) => fetchMetar(a.icao))), fetchForecasts()]);
    const now = new Date();
    weather = { fetchedAt: now.toISOString(), airports: AIRPORTS.map((ap, i) => {
      const metar = metars[i]; if (metar) metar.fltCat = fltCatOf(metar);
      const slots = slotsFromForecast(ap, forecasts[i], now);
      let rowAlert = "none"; for (const s of slots) rowAlert = worse(rowAlert, s.alert);
      if (metar) rowAlert = worse(rowAlert, alertLevel(metar));
      return Object.assign({}, ap, { metar: metar || {}, slots, rowAlert });
    }) };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(weather)); } catch (_) {}
    banner.hidden = true; paint();
  } catch (e) {
    console.error(e);
    try { weather = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (_) { weather = null; }
    banner.hidden = false; banner.textContent = weather ? "Using last saved board" : "Weather feed error \u2014 retrying";
    if (weather) paint();
  }
}
function schedule() { setInterval(load, 5*60*1000); setInterval(tickClocks, 1000); }
(function scroll() {
  const root = document.querySelector(".track");
  const tick = () => {
    const copy = document.getElementById("first");
    if (copy && Date.now() > pausedUntil) {
      const h = copy.offsetHeight;
      if (h > 0) { offset += 0.28; if (offset >= h) offset -= h; root.style.transform = "translateY("+(-offset)+"px)"; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const pause = () => { pausedUntil = Date.now() + 6000; };
  window.addEventListener("pointerdown", pause);
  window.addEventListener("wheel", pause, { passive: true });
})();
if (navigator.wakeLock) navigator.wakeLock.request("screen").catch(() => {});
document.getElementById("refresh").onclick = load;
load().then(schedule);
