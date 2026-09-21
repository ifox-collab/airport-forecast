const AIRPORTS = [
  { iata: "BNE", icao: "YBBN", name: "Brisbane", lat: -27.3842, lon: 153.1170, tz: "Australia/Brisbane" },
  { iata: "MEL", icao: "YMML", name: "Melbourne", lat: -37.6733, lon: 144.8433, tz: "Australia/Melbourne" },
  { iata: "SYD", icao: "YSSY", name: "Sydney", lat: -33.9461, lon: 151.1772, tz: "Australia/Sydney" },
  { iata: "ADL", icao: "YPAD", name: "Adelaide", lat: -34.9450, lon: 138.5306, tz: "Australia/Adelaide" },
  { iata: "PER", icao: "YPPH", name: "Perth", lat: -31.9403, lon: 115.9669, tz: "Australia/Perth" },
  { iata: "CNS", icao: "YBCS", name: "Cairns", lat: -16.8858, lon: 145.7553, tz: "Australia/Brisbane" },
  { iata: "DRW", icao: "YPDN", name: "Darwin", lat: -12.4147, lon: 130.8766, tz: "Australia/Darwin" },
  { iata: "NLK", icao: "YSNF", name: "Norfolk Island", lat: -29.0417, lon: 167.9383, tz: "Pacific/Norfolk" },
  { iata: "LST", icao: "YMLT", name: "Launceston", lat: -41.5453, lon: 147.2142, tz: "Australia/Hobart" },
  { iata: "AKL", icao: "NZAA", name: "Auckland", lat: -37.0081, lon: 174.7920, tz: "Pacific/Auckland" },
  { iata: "CHC", icao: "NZCH", name: "Christchurch", lat: -43.4894, lon: 172.5320, tz: "Pacific/Auckland" },
  { iata: "PMR", icao: "NZPM", name: "Palmerston North", lat: -40.3206, lon: 175.6170, tz: "Pacific/Auckland" }
];
const STEP = 3;
const ALERT_HOURS = 18;

function wxIcon(code) {
  if (code == null) return { icon: "\u2753", label: "" };
  if (code === 0) return { icon: "\u2600\uFE0F", label: "Clear" };
  if (code === 1) return { icon: "\uD83C\uDF24\uFE0F", label: "Mainly clear" };
  if (code === 2) return { icon: "\u26C5", label: "Partly cloudy" };
  if (code === 3) return { icon: "\u2601\uFE0F", label: "Overcast" };
  if (code === 45 || code === 48) return { icon: "\uD83C\uDF2B\uFE0F", label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "\uD83C\uDF26\uFE0F", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { icon: "\uD83C\uDF27\uFE0F", label: "Rain" };
  if (code >= 71 && code <= 77) return { icon: "\uD83C\uDF28\uFE0F", label: "Snow" };
  if (code >= 80 && code <= 82) return { icon: "\uD83C\uDF26\uFE0F", label: "Showers" };
  if (code >= 95) return { icon: "\u26C8\uFE0F", label: "Thunder" };
  return { icon: "\u2601\uFE0F", label: "" };
}

function evaluateSlot(code, spd, gust, vis, precipProb, lowCloud) {
  const warnings = [];
  let level = null;
  if (typeof vis === "number" && vis < 1000) { warnings.push("Vis <1000m"); level = "high"; }
  if (spd != null && spd >= 35) { warnings.push("Wind " + Math.round(spd) + "kt"); level = "high"; }
  if (gust != null && gust >= 45) { warnings.push("Gust " + Math.round(gust) + "kt"); level = "high"; }
  if (code >= 95) { warnings.push("Thunderstorm"); level = "high"; }
  if (code === 65 || code === 82) { warnings.push("Heavy rain"); level = "high"; }
  if (code === 45 || code === 48) { warnings.push("Fog"); level = "high"; }
  if (!level) {
    if (gust != null && spd != null && gust - spd >= 18) { warnings.push("Large gust spread"); level = "medium"; }
    if (lowCloud != null && lowCloud > 70 && typeof vis === "number" && vis < 5000) {
      warnings.push(Math.round(lowCloud) + "% low cloud"); level = "medium";
    }
  }
  return { warnings, level };
}

function windClass(kn) {
  if (kn == null) return "";
  if (kn < 15) return "low";
  if (kn < 25) return "med";
  return "high";
}

function airportTimes(tz) {
  const now = new Date();
  return {
    local: now.toLocaleTimeString("en-AU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }),
    utc: now.toLocaleTimeString("en-AU", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })
  };
}

function slotLabel(iso, tz) {
  const localHm = iso.length >= 16 ? iso.slice(11, 16) : "--:--";
  let zulu = "--:--";
  try {
    const [y, mo, day] = iso.slice(0, 10).split("-").map(Number);
    const [hh, mm] = localHm.split(":").map(Number);
    let utcMs = Date.UTC(y, mo - 1, day, hh, mm, 0);
    const fmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
    const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, 0);
    const trueUtc = new Date(utcMs - (asLocal - utcMs));
    zulu = trueUtc.toLocaleTimeString("en-AU", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch (_) {}
  const dayName = new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  return dayName + " " + localHm + " (" + zulu + "Z)";
}

function flightCategory(raw) {
  if (!raw) return "";
  if (raw.category) return String(raw.category).toUpperCase();
  if (raw.fltCat) return String(raw.fltCat).toUpperCase();
  let visM = null;
  const v = raw.visibility ?? raw.visibilitySm ?? raw.visib ?? raw.vis;
  if (typeof v === "number") visM = v < 50 ? v * 1609.34 : v;
  else if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) visM = n < 50 ? n * 1609.34 : n;
    if (/\+|SM/i.test(v) && n >= 6) visM = 9999;
  }
  const ob = raw.raw || raw.rawOb || "";
  if (visM == null && ob) {
    let m;
    if ((m = ob.match(/\b(\d{4})\b/))) visM = parseInt(m[1], 10);
    else if ((m = ob.match(/\b(\d{1,2})\s*SM\b/i))) visM = parseFloat(m[1]) * 1609.34;
    else if ((m = ob.match(/\bP?(\d+)\s*SM\b/i))) visM = parseFloat(m[1]) * 1609.34;
  }
  let ceilingFt = null;
  const layers = raw.cloudLayers || raw.clouds || [];
  for (const c of layers) {
    const cover = String(c.cover || c || "").toUpperCase();
    const base = c.baseFt ?? c.base ?? null;
    if ((cover.startsWith("BKN") || cover.startsWith("OVC") || cover === "BKN" || cover === "OVC") && base != null) {
      ceilingFt = ceilingFt == null ? base : Math.min(ceilingFt, base);
    }
  }
  if (ceilingFt == null && ob) {
    let m;
    if ((m = ob.match(/\b(BKN|OVC)(\d{3})\b/))) ceilingFt = parseInt(m[2], 10) * 100;
  }
  const visSm = visM != null ? visM / 1609.34 : null;
  if (visSm != null && visSm < 1) return "LIFR";
  if (ceilingFt != null && ceilingFt < 500) return "LIFR";
  if (visSm != null && visSm < 3) return "IFR";
  if (ceilingFt != null && ceilingFt < 1000) return "IFR";
  if (visSm != null && visSm <= 5) return "MVFR";
  if (ceilingFt != null && ceilingFt <= 3000) return "MVFR";
  if (visSm != null || ceilingFt != null || ob) return "VFR";
  return "";
}

async function fetchMetar(icao) {
  try {
    const res = await fetch("https://rotatepilot.com/api/v1/metar?icao=" + icao + "&taf=1");
    if (res.ok) {
      const data = await res.json();
      if (data && data.raw) return data;
    }
  } catch (_) {}
  try {
    const res = await fetch("https://metar.vatsim.net/" + icao);
    if (res.ok) {
      const raw = (await res.text()).trim();
      if (raw.length > 10) return { raw, icao, reportTime: new Date().toISOString() };
    }
  } catch (_) {}
  return null;
}

async function fetchForecast() {
  const batchSize = 4;
  const out = new Array(AIRPORTS.length);
  for (let i = 0; i < AIRPORTS.length; i += batchSize) {
    const batch = AIRPORTS.slice(i, i + batchSize);
    const params = new URLSearchParams({
      latitude: batch.map(a => a.lat).join(","),
      longitude: batch.map(a => a.lon).join(","),
      hourly: "temperature_2m,dew_point_2m,precipitation_probability,weather_code,cloud_cover,cloud_cover_low,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
      wind_speed_unit: "kn",
      timezone: "auto",
      forecast_days: "3"
    });
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt) await new Promise(r => setTimeout(r, 800 * attempt));
        const res = await fetch("https://api.open-meteo.com/v1/forecast?" + params);
        if (res.status === 429) continue;
        if (!res.ok) throw new Error("OM " + res.status);
        data = await res.json();
        break;
      } catch (_) {}
    }
    const arr = data ? (Array.isArray(data) ? data : [data]) : batch.map(() => null);
    arr.forEach((d, j) => { out[i + j] = d; });
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i] && out[i].hourly) continue;
    try {
      const ap = AIRPORTS[i];
      const res = await fetch(
        "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + ap.lat + "&lon=" + ap.lon,
        { headers: { "User-Agent": "airport-forecast-board/1.0" } }
      );
      if (res.ok) out[i] = { _metno: await res.json() };
    } catch (_) {}
  }
  return out;
}

function slotsFromOpenMeteo(fc, ap, now) {
  const slots = [];
  if (!fc || !fc.hourly) return { slots, rowLevel: null };
  const h = fc.hourly;
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= now - 30 * 60 * 1000) { start = i; break; }
  }
  const cutoff = now + ALERT_HOURS * 3600 * 1000;
  let rowLevel = null;
  for (let i = start, n = 0; i < h.time.length && n < 10; i += STEP, n++) {
    const t = h.time[i];
    const tMs = new Date(t).getTime();
    const code = h.weather_code[i];
    const spd = h.wind_speed_10m[i];
    const gust = h.wind_gusts_10m[i];
    const vis = h.visibility[i];
    const lowCloud = h.cloud_cover_low[i];
    const precip = h.precipitation_probability ? h.precipitation_probability[i] : null;
    const ev = evaluateSlot(code, spd, gust, vis, precip, lowCloud);
    if (ev.level === "high" && tMs <= cutoff) rowLevel = "high";
    else if (ev.level === "medium" && tMs <= cutoff && rowLevel !== "high") rowLevel = "medium";
    const wx = wxIcon(code);
    slots.push({
      label: slotLabel(t, ap.tz),
      nearNow: Math.abs(tMs - now) < 90 * 60 * 1000,
      icon: wx.icon,
      wind: spd != null ? Math.round(spd) : null,
      windDir: h.wind_direction_10m[i],
      gust: gust != null ? Math.round(gust) : null,
      temp: h.temperature_2m[i] != null ? Math.round(h.temperature_2m[i]) : null,
      dew: h.dew_point_2m[i] != null ? Math.round(h.dew_point_2m[i]) : null,
      vis: typeof vis === "number" ? (vis >= 10000 ? "10000m+" : Math.round(vis) + "m") : "\u2014",
      visM: typeof vis === "number" ? vis : null,
      cloud: h.cloud_cover[i] != null ? Math.round(h.cloud_cover[i]) : null,
      lowCloud: lowCloud != null ? Math.round(lowCloud) : null,
      warnings: ev.warnings,
      level: ev.level
    });
  }
  return { slots, rowLevel };
}

function slotsFromMetNo(data, ap, now) {
  const ts = (((data || {}).properties || {}).timeseries) || [];
  const slots = [];
  let rowLevel = null;
  for (let i = 0; i < ts.length && slots.length < 10; i++) {
    const pt = ts[i];
    const tMs = new Date(pt.time).getTime();
    if (tMs < now - 30 * 60 * 1000) continue;
    if (slots.length) {
      const last = new Date(slots[slots.length - 1]._iso).getTime();
      if (tMs - last < 2.5 * 3600 * 1000) continue;
    }
    const det = (pt.data.instant || {}).details || {};
    const next = pt.data.next_1_hours || pt.data.next_6_hours || {};
    const symbol = ((next.summary || {}).symbol_code) || "";
    let code = 3, icon = "\u2601\uFE0F";
    if (symbol.includes("clearsky")) { code = 0; icon = "\u2600\uFE0F"; }
    else if (symbol.includes("fair")) { code = 1; icon = "\uD83C\uDF24\uFE0F"; }
    else if (symbol.includes("partlycloudy")) { code = 2; icon = "\u26C5"; }
    else if (symbol.includes("fog")) { code = 45; icon = "\uD83C\uDF2B\uFE0F"; }
    else if (symbol.includes("thunder")) { code = 95; icon = "\u26C8\uFE0F"; }
    else if (symbol.includes("rain")) { code = 63; icon = "\uD83C\uDF27\uFE0F"; }
    const spd = det.wind_speed != null ? det.wind_speed * 1.94384 : null;
    const cloud = det.cloud_area_fraction != null ? Math.round(det.cloud_area_fraction) : null;
    const ev = evaluateSlot(code, spd, null, null, null, cloud);
    if (ev.level === "high") rowLevel = "high";
    else if (ev.level === "medium" && rowLevel !== "high") rowLevel = "medium";
    const utc = new Date(pt.time);
    const localHm = utc.toLocaleTimeString("en-AU", { timeZone: ap.tz, hour: "2-digit", minute: "2-digit", hour12: false });
    const day = utc.toLocaleDateString("en-AU", { timeZone: ap.tz, weekday: "short" });
    const zulu = utc.toLocaleTimeString("en-AU", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });
    slots.push({
      _iso: pt.time,
      label: day + " " + localHm + " (" + zulu + "Z)",
      nearNow: Math.abs(tMs - now) < 90 * 60 * 1000,
      icon,
      wind: spd != null ? Math.round(spd) : null,
      windDir: det.wind_from_direction != null ? Math.round(det.wind_from_direction) : null,
      gust: null,
      temp: det.air_temperature != null ? Math.round(det.air_temperature) : null,
      dew: null,
      vis: "\u2014",
      visM: null,
      cloud,
      lowCloud: cloud,
      warnings: ev.warnings,
      level: ev.level
    });
  }
  return { slots, rowLevel };
}

function render(metars, forecasts, meta) {
  const now = Date.now();
  let html = "";
  for (let idx = 0; idx < AIRPORTS.length; idx++) {
    const ap = AIRPORTS[idx];
    const times = airportTimes(ap.tz);
    const raw = metars[idx];
    const fc = forecasts[idx];
    let built = { slots: [], rowLevel: null };
    if (fc && fc.hourly) built = slotsFromOpenMeteo(fc, ap, now);
    else if (fc && fc._metno) built = slotsFromMetNo(fc._metno, ap, now);
    const rowClass = built.rowLevel === "high" ? "alert-high" : built.rowLevel === "medium" ? "alert-medium" : "";
    const slotSrc = (fc && fc.hourly) ? "MODEL" : (fc && fc._metno) ? "MODEL" : "\u2014";
    html += '<div class="airport ' + rowClass + '"><div class="airport-header"><div class="left">';
    html += '<span class="icao">' + ap.iata + ' / ' + ap.icao + '</span>';
    html += '<span class="name">' + ap.name + '</span>';
    html += '<span class="name">' + times.local + ' <span style="opacity:0.85;color:#e2e8f0;">(' + times.utc + ' UTC)</span></span>';
    html += '<span class="src-badge model">' + slotSrc + '</span>';
    html += '</div>';
    var cat = flightCategory(raw);
    if (cat) html += '<span class="fltcat ' + cat + '">' + cat + '</span>';
    html += '</div>';
    if (raw && raw.raw) {
      const temp = raw.temperatureC ?? raw.temp;
      const dewp = raw.dewpointC ?? raw.dewp;
      const wdir = raw.windDir ?? raw.wdir;
      const wspd = raw.windSpeedKt ?? raw.wspd;
      const wgst = raw.windGustKt ?? raw.wgst;
      let qnh = raw.altimeterInHg ?? raw.altimeter ?? raw.qnh;
      if (qnh != null) qnh = qnh > 50 ? Math.round(qnh) : Math.round(qnh * 33.8639);
      html += '<div class="metar-strip"><div class="metar-decoded">';
      html += '<span class="metar-item"><strong>Wind</strong>' + (wdir != null ? wdir : "VRB") + '\u00b0 ' + (wspd != null ? wspd : "\u2014") + 'kt' + (wgst ? " G" + wgst : "") + '</span>';
      html += '<span class="metar-item"><strong>Temp/Dew</strong>' + (temp != null ? Math.round(temp) : "\u2014") + '\u00b0 / ' + (dewp != null ? Math.round(dewp) : "\u2014") + '\u00b0</span>';
      html += '<span class="metar-item"><strong>QNH</strong>' + (qnh != null ? qnh : "\u2014") + '</span>';
      html += '<span class="src-badge metar">METAR</span>';
      html += '</div><div class="metar-raw">' + (raw.raw || "") + '</div>';
      var tafRaw = raw.tafRaw || raw.taf || raw.rawTaf || "";
      if (typeof tafRaw === "object" && tafRaw) tafRaw = tafRaw.raw || tafRaw.text || "";
      if (tafRaw) html += '<div class="metar-raw taf-line"><span class="src-badge taf">TAF</span> ' + String(tafRaw) + '</div>';
      html += '</div>';
    } else {
      html += '<div class="metar-strip"><div class="metar-decoded"><span class="metar-item">No recent METAR</span></div></div>';
    }
    html += '<div class="timeline">';
    if (!built.slots.length) {
      html += '<div class="slot" style="min-width:200px;color:var(--muted);">Forecast unavailable</div>';
    } else {
      for (const s of built.slots) {
        let sc = s.nearNow ? "now" : "";
        if (s.level === "high") sc += " alert-high";
        else if (s.level === "medium") sc += " alert-medium";
        const warn = s.warnings && s.warnings.length ? '<div class="warn-text ' + s.level + '">' + s.warnings.join(" \u00b7 ") + '</div>' : "";
        html += '<div class="slot ' + sc + '">';
        html += '<div class="slot-time">' + s.label + '</div>';
        html += '<span class="wx-icon">' + (s.icon || "\u2601\uFE0F") + '</span>';
        html += '<div class="wind-row wind ' + windClass(s.wind) + '">' + (s.wind != null ? s.wind + ' kt' : "\u2014") + '</div>';
        html += '<div class="gust">G ' + (s.gust != null ? s.gust + ' kt' : "\u2014") + '</div>';
        html += '<div class="temp-row">' + (s.temp != null ? s.temp : "\u2014") + '\u00b0 <span class="dew">/ ' + (s.dew != null ? s.dew : "\u2014") + '\u00b0</span></div>';
        html += '<div class="vis ' + (s.visM != null && s.visM < 3000 ? "poor" : "") + '">' + (s.vis || "\u2014") + '</div>';
        html += '<div class="cloud">' + (s.cloud != null ? s.cloud : "\u2014") + '% clouds</div>';
        html += warn + '</div>';
      }
    }
    html += '</div></div>';
  }
  document.getElementById("content").innerHTML = html;
}

const CACHE_KEY = "afb-last-good-v2";
function saveCache(metars, forecasts) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), metars, forecasts })); } catch (_) {}
}
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (_) { return null; }
}

async function loadAll() {
  const btn = document.getElementById("refreshBtn");
  const status = document.getElementById("status");
  btn.disabled = true;
  status.textContent = "Updating\u2026";
  status.classList.remove("error", "stale");
  try {
    const settled = await Promise.allSettled([
      Promise.all(AIRPORTS.map(a => fetchMetar(a.icao))),
      fetchForecast()
    ]);
    let metars = settled[0].status === "fulfilled" ? settled[0].value : AIRPORTS.map(() => null);
    let forecasts = settled[1].status === "fulfilled" ? settled[1].value : AIRPORTS.map(() => null);
    const metarOk = Array.isArray(metars) && metars.some(m => m && m.raw);
    const fcOk = Array.isArray(forecasts) && forecasts.some(f => f && (f.hourly || f._metno));
    let stale = false;
    if (!metarOk || !fcOk) {
      const cached = readCache();
      if (cached) {
        if (!metarOk) metars = cached.metars;
        if (!fcOk) forecasts = cached.forecasts;
        stale = true;
      }
    } else {
      saveCache(metars, forecasts);
    }
    render(metars, forecasts, { stale });
    const when = new Date().toLocaleString("en-AU", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    if (stale) {
      const c = readCache();
      const ageMin = c ? Math.round((Date.now() - c.t) / 60000) : "?";
      status.textContent = "STALE";
      status.classList.add("stale");
      document.getElementById("lastUpdated").textContent = "STALE \u00b7 last good ~" + ageMin + " min ago \u00b7 " + when;
    } else {
      status.textContent = "Live";
      document.getElementById("lastUpdated").textContent = "Updated " + when;
    }
    setTimeout(setupScroll, 400);
  } catch (e) {
    console.error(e);
    const cached = readCache();
    if (cached) {
      render(cached.metars, cached.forecasts, { stale: true });
      status.textContent = "STALE";
      status.classList.add("stale");
      document.getElementById("lastUpdated").textContent = "Using last saved board";
      setTimeout(setupScroll, 400);
    } else {
      status.textContent = "Error";
      status.classList.add("error");
    }
  } finally {
    btn.disabled = false;
  }
}

let scrollPaused = false, oneCopyHeight = 0;
function setupScroll() {
  const main = document.getElementById("content");
  const old = document.getElementById("content-clone");
  if (old) old.remove();
  const clone = main.cloneNode(true);
  clone.id = "content-clone";
  clone.setAttribute("aria-hidden", "true");
  clone.style.pointerEvents = "none";
  main.after(clone);
  oneCopyHeight = main.offsetHeight;
}
setInterval(() => {
  if (scrollPaused || oneCopyHeight <= 0) return;
  window.scrollBy(0, 0.8);
  if (window.scrollY >= oneCopyHeight) window.scrollTo({ top: window.scrollY - oneCopyHeight, behavior: "instant" });
}, 25);
window.addEventListener("wheel", () => {
  scrollPaused = true;
  clearTimeout(window._rt);
  window._rt = setTimeout(() => { scrollPaused = false; }, 8000);
}, { passive: true });
async function wake() {
  try { if ("wakeLock" in navigator) await navigator.wakeLock.request("screen"); } catch (_) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wake(); });
wake();
document.getElementById("refreshBtn").onclick = loadAll;
loadAll();
setInterval(loadAll, 5 * 60 * 1000);
