const COLORS = ["#f8fafc", "#7c8cff", "#7dd3c7", "#e08a8a"];
const canvas = document.getElementById("c");
const ctx = canvas ? canvas.getContext("2d") : null;
const start = performance.now();
function fit() {
  if (!canvas || !ctx) return;
  const r = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(400, Math.floor(r.width * dpr));
  canvas.height = Math.floor(72 * dpr);
}
if (canvas) { fit(); window.addEventListener("resize", fit); }
function limb(ax, ay, ang, len) { return [ax + Math.sin(ang) * len, ay + Math.cos(ang) * len]; }
function drawHair(x, y, color, tilt) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
  for (let i = -2; i <= 2; i++) {
    const dx = i * 5;
    ctx.beginPath(); ctx.moveTo(x + dx + tilt * 4, y - 16); ctx.lineTo(x + dx + tilt * 2, y - 6); ctx.stroke();
  }
}
function drawHead(x, y, color, tilt, look) {
  drawHair(x + look * 6, y, color, tilt);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x - 6 + tilt * 2 + look * 6, y - 1, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6 + tilt * 2 + look * 6, y - 1, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(x + tilt * 2 + look * 6, y + 2, 8, 0.2, Math.PI - 0.2, false); ctx.stroke();
}
function joints(ulL, ulR, uaL, uaR) {
  const bL = 0.28 + Math.max(0, ulL) * 1.15 + Math.max(0, -ulL) * 0.2;
  const bR = 0.28 + Math.max(0, ulR) * 1.15 + Math.max(0, -ulR) * 0.2;
  return { ulL: ulL, llL: ulL - bL, ulR: ulR, llR: ulR - bR, uaL: uaL, laL: uaL * 0.22, uaR: uaR, laR: uaR * 0.22 };
}
function poseWalk(t) {
  const w = t * Math.PI * 2, sl = Math.sin(w), sr = Math.sin(w + Math.PI);
  const j = joints(0.42 * sl, 0.42 * sr, 0.5 * sr, 0.5 * sl);
  return Object.assign({ hipY: Math.abs(sl) * 3.2, tilt: 0.12, spin: 0, look: 0 }, j);
}
function poseRun(t, look) {
  const w = t * Math.PI * 2, sl = Math.sin(w), sr = Math.sin(w + Math.PI);
  const j = joints(0.62 * sl, 0.62 * sr, 0.75 * sr, 0.75 * sl);
  j.llL -= Math.max(0, sl) * 0.25; j.llR -= Math.max(0, sr) * 0.25;
  return Object.assign({ hipY: Math.abs(sl) * 5, tilt: 0.2, spin: 0, look: look || 0 }, j);
}
function poseStand(look, breath) {
  return Object.assign({ hipY: breath || 0, tilt: 0.04, spin: 0, look: look || 0 }, joints(0.08, -0.06, 0.18, 0.12));
}
function poseBarrel(ph) {
  const w = ph * Math.PI * 2;
  return Object.assign({ hipY: 8 + Math.sin(ph * Math.PI) * 42, tilt: 0, spin: w, look: 0 }, joints(0.5 * Math.sin(w), -0.4 * Math.cos(w), 0.8, -0.3));
}
function poseConor(t, facing) {
  const w = t * Math.PI * 2, sl = Math.sin(w) * facing, sr = Math.sin(w + Math.PI) * facing;
  const j = joints(0.28 * sl, 0.28 * sr, 0.38 * sr, 0.38 * sl);
  return Object.assign({ hipY: 1.5 + Math.abs(Math.sin(w)) * 3.2, tilt: 0.08 * facing, spin: 0, look: 0.1 * facing }, j);
}
function poseGroup(move, t, who) {
  const w = t * Math.PI * 2, s = Math.sin(w), c = Math.cos(w);
  if (move === 0) return poseWalk(t);
  if (move === 1) {
    const j = joints(0.35 * s, 0.2 + Math.abs(s) * 0.35, 0.2, 1.1 + s * 0.35); j.laR = 0.25;
    return Object.assign({ hipY: Math.abs(s) * 10, tilt: 0.18, spin: 0, look: 0 }, j);
  }
  if (move === 2) {
    const up = Math.max(0, -c);
    const j = joints(-0.05 + up * 0.3, 0.2 + up * 0.45, 0.4 + up * 1.4, 0.6 + up * 1.5); j.laL = 0.15; j.laR = 0.12;
    return Object.assign({ hipY: up * 16, tilt: 0.08, spin: 0, look: 0 }, j);
  }
  if (move === 3) return Object.assign({ hipY: 2 + Math.abs(s) * 3, tilt: 0.2, spin: 0, look: 0 }, joints(-0.2 + s * 0.15, 0.45 + s * 0.3, 0.9 + s * 0.25, 0.15 - s * 0.2));
  if (move === 4) return Object.assign({ hipY: 8 + (1 - c) * 6, tilt: 0, spin: w, look: 0 }, joints(-0.15, 0.4, 0.5, 1.0));
  if (move === 5) {
    const j = joints(-0.12, 0.3 + Math.abs(s) * 0.2, 0.55 + s * 0.4, 0.85 - s * 0.4); j.laL = -0.2; j.laR = 0.15;
    return Object.assign({ hipY: Math.abs(s) * 6, tilt: 0.14, spin: 0, look: 0 }, j);
  }
  if (move === 6) {
    const j = joints(-0.15, 0.35, 0.25, 1.7 + s * 0.15); j.laR = 0.2;
    return Object.assign({ hipY: Math.abs(s) * 8, tilt: 0.18, spin: 0, look: 0 }, j);
  }
  if (move === 7) {
    const down = c * 0.5 + 0.5;
    return Object.assign({ hipY: 6 + down * 14, tilt: 0.12, spin: 0, look: 0 }, joints(0.3 + down * 0.4, 0.45 + down * 0.3, 0.45, 0.7));
  }
  if (move === 8) {
    const k = Math.sin(w + who * 0.35);
    return Object.assign({ hipY: 10 + k * 10, tilt: 0.22 + k * 0.15, spin: 0.12, look: 0 }, joints(0.12, 0.7, 0.35, 1.2));
  }
  const j = joints(-0.08, 0.3 + Math.max(0, s) * 1.1, 0.35, 1.15); j.llR = 0.15;
  return Object.assign({ hipY: Math.abs(s) * 4, tilt: 0.16, spin: 0, look: 0 }, j);
}
function poseCool(who, t) {
  const w = t * Math.PI * 2, s = Math.sin(w), c = Math.cos(w);
  const set = who % 4;
  if (set === 0) return Object.assign({ hipY: 8 + (1 - c) * 10, tilt: 0, spin: w * 0.5, look: 0 }, joints(0.7, -0.25, 1.3, -0.15));
  if (set === 1) {
    const up = Math.max(0, -c) * 12;
    const j = joints(0.15, 0.4, 0.35 + s * 0.9, 1.5); j.laR = 0.2;
    return Object.assign({ hipY: up, tilt: 0.1, spin: 0, look: 0 }, j);
  }
  if (set === 2) {
    const j = joints(-0.1, 0.25 + Math.max(0, s) * 1.2, 0.25, 1.6); j.llR = 0.12; j.laR = 0.15;
    return Object.assign({ hipY: Math.abs(s) * 8, tilt: 0.18, spin: s * 0.3, look: 0.3 }, j);
  }
  return Object.assign({ hipY: 12 + s * 10, tilt: 0.25, spin: 0.15, look: 0 }, joints(0.15, 0.7, 0.4, 1.15));
}
function drawDude(x, ground, color, p) {
  const hipX = x, hipY = ground - 34 + p.hipY;
  ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(p.spin + (p.tilt || 0)); ctx.translate(-hipX, -hipY);
  const neckY = hipY - 22, headY = neckY - 10;
  drawHead(hipX, headY, color, p.tilt, p.look || 0);
  ctx.strokeStyle = color; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(hipX, neckY); ctx.lineTo(hipX, hipY); ctx.stroke();
  const eL = limb(hipX, neckY + 6, p.uaL, 14), hL = limb(eL[0], eL[1], p.laL, 12);
  const eR = limb(hipX, neckY + 6, p.uaR, 14), hR = limb(eR[0], eR[1], p.laR, 12);
  ctx.beginPath(); ctx.moveTo(hipX, neckY + 6); ctx.lineTo(eL[0], eL[1]); ctx.lineTo(hL[0], hL[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, neckY + 6); ctx.lineTo(eR[0], eR[1]); ctx.lineTo(hR[0], hR[1]); ctx.stroke();
  const kL = limb(hipX, hipY, p.ulL, 16), fL = limb(kL[0], kL[1], p.llL, 16);
  const kR = limb(hipX, hipY, p.ulR, 16), fR = limb(kR[0], kR[1], p.llR, 16);
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kL[0], kL[1]); ctx.lineTo(fL[0], fL[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kR[0], kR[1]); ctx.lineTo(fR[0], fR[1]); ctx.stroke();
  ctx.restore();
}
const PHASES = [];
function add(type, dur, extra) { PHASES.push(Object.assign({ type: type, dur: dur }, extra || {})); }
add("run1", 18); add("wait", 60); add("run2", 30); add("wait", 15); add("run3", 27); add("wait", 10); add("run4", 39);
for (let i = 0; i < 20; i++) { add("dance", 22, { move: i % 10, cool: i >= 10 }); add("swagger", 14, { who: i % 4 }); }
const LOOP = PHASES.reduce(function(s, p) { return s + p.dur; }, 0);
function at(sec) {
  let t = ((sec % LOOP) + LOOP) % LOOP;
  for (let i = 0; i < PHASES.length; i++) { if (t < PHASES[i].dur) return { phase: PHASES[i], local: t }; t -= PHASES[i].dur; }
  return { phase: PHASES[0], local: 0 };
}
function lerp(a, b, t) { t = Math.max(0, Math.min(1, t)); return a + (b - a) * t; }
function frame(now) {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.width / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, 72);
  const scale = 72 / 130; ctx.scale(scale, scale);
  const w = cssW / scale, ground = 118;
  const hit = at((now - start) / 1000), phase = hit.phase, local = hit.local, type = phase.type;
  if (type === "run1") drawDude(lerp(-80, w + 80, local / phase.dur), ground, COLORS[0], poseRun(local / 1.05, Math.sin(local * 3)));
  else if (type === "run2") {
    var x, p;
    if (local < 4.5) { x = lerp(-80, w * 0.45, local / 4.5); p = poseRun(local / 1.05); }
    else if (local < 8.1) { var ph = (local - 4.5) / 3.6; x = lerp(w * 0.45, w * 0.82, ph); p = poseBarrel(ph); }
    else if (local < 12.6) { x = w * 0.82; p = poseStand(0, Math.sin((local - 8.1) * 4) * 2); }
    else { x = lerp(w * 0.82, w + 80, (local - 12.6) / 17.4); p = poseRun((local - 12.6) / 1.05); }
    drawDude(x, ground, COLORS[1], p);
  } else if (type === "run3") {
    var x3, p3;
    if (local < 3.3) { x3 = lerp(-80, w * 0.5, local / 3.3); p3 = poseRun(local / 1.05); }
    else if (local < 10.8) { x3 = w * 0.5; p3 = poseStand(Math.sin((local - 3.3) * 2.2) * 1.2, 0); }
    else { x3 = lerp(w * 0.5, w + 80, (local - 10.8) / 16.2); p3 = poseWalk((local - 10.8) / 1.3); }
    drawDude(x3, ground, COLORS[2], p3);
  } else if (type === "run4") {
    var x4, p4;
    if (local < 7.5) { x4 = lerp(-80, w * 0.5, local / 7.5); p4 = poseConor(local / 2.4, 1); }
    else if (local < 10.5) { x4 = w * 0.5; p4 = poseConor(0.08, 1); p4.hipY = 1.5; }
    else if (local < 16.5) { x4 = lerp(w * 0.5, 140, (local - 10.5) / 6); p4 = poseConor((local - 10.5) / 2.4, -1); }
    else { x4 = lerp(140, w + 80, (local - 16.5) / 22.5); p4 = poseConor((local - 16.5) / 2.4, 1); }
    drawDude(x4, ground, COLORS[3], p4);
  } else if (type === "dance") {
    var cycle = (local / 2.0) % 1;
    var speed = (w + 160) / 16;
    for (var i = 0; i < 4; i++) {
      var delay = i * 1.9, age = local - delay;
      if (age < 0) continue;
      var xd = -80 + age * speed;
      if (xd > w + 90) continue;
      drawDude(xd, ground, COLORS[i], phase.cool ? poseCool(i + phase.move, cycle) : poseGroup(phase.move, cycle, i));
    }
  } else if (type === "swagger") {
    drawDude(lerp(-80, w + 80, local / phase.dur), ground, COLORS[phase.who], poseConor(local / 1.6, 1));
  }
  requestAnimationFrame(frame);
}
if (canvas) requestAnimationFrame(frame);
