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
function poseWalk(t) {
  const s = Math.sin(t * Math.PI * 2), a = s;
  return { hipY: Math.abs(s) * 3, tilt: 0.16, spin: 0, look: 0, uaL: 0.85 + a * 0.45, laL: 0.5, uaR: 0.15 - a * 0.45, laR: 0.45, ulL: -0.12 - a * 0.38, llL: 0.5 + Math.max(0, a) * 0.55, ulR: 0.42 + a * 0.55, llR: 0.35 + Math.max(0, -a) * 0.6 };
}
function poseRun(t, look) {
  const s = Math.sin(t * Math.PI * 2), a = s;
  return { hipY: Math.abs(s) * 4, tilt: 0.22, spin: 0, look: look || 0, uaL: 0.95 + a * 0.7, laL: 0.55, uaR: 0.05 - a * 0.7, laR: 0.5, ulL: -0.15 - a * 0.55, llL: 0.35 + Math.max(0, a) * 0.85, ulR: 0.55 + a * 0.7, llR: 0.2 + Math.max(0, -a) * 0.9 };
}
function poseStand(look, breath) {
  return { hipY: breath || 0, tilt: 0.04, spin: 0, look: look || 0, uaL: 0.25, laL: 0.2, uaR: 0.2, laR: 0.2, ulL: 0.08, llL: 0.12, ulR: -0.05, llR: 0.12 };
}
function poseBarrel(ph) {
  return { hipY: 8 + Math.sin(ph * Math.PI) * 42, tilt: 0, spin: ph * Math.PI * 2, look: 0, uaL: 1.3, laL: 0.35, uaR: -0.2, laR: 0.9, ulL: 0.6, llL: 0.35, ulR: -0.4, llR: 0.5 };
}
function poseConor(t, facing) {
  const s = Math.sin(t * Math.PI * 2), a = s * facing;
  return { hipY: 1.5 + Math.abs(s) * 3.2, tilt: 0.08 * facing, spin: 0, look: 0.1 * facing, uaL: 0.55 + a * 0.35, laL: 0.55, uaR: 0.28 - a * 0.35, laR: 0.5, ulL: -0.06 - a * 0.18, llL: 0.28, ulR: 0.22 + a * 0.28, llR: 0.24 };
}
function poseGroup(move, t, who) {
  const w = t * Math.PI * 2, s = Math.sin(w), c = Math.cos(w);
  if (move === 0) return poseWalk(t);
  if (move === 1) return { hipY: Math.abs(s) * 10, tilt: 0.2 + s * 0.08, spin: 0, look: 0, uaL: 0.35, laL: 0.5, uaR: 1.55 + s * 0.25, laR: 0.25, ulL: -0.15, llL: 0.7, ulR: 0.45 + Math.abs(s) * 0.25, llR: 0.55 };
  if (move === 2) { const up = Math.max(0, -c); return { hipY: up * 16, tilt: 0.08, spin: 0, look: 0, uaL: 0.55 + up * 1.7, laL: 0.15, uaR: 0.9 + up * 1.9, laR: 0.1, ulL: -0.05 + up * 0.35, llL: 0.25, ulR: 0.25 + up * 0.55, llR: 0.2 }; }
  if (move === 3) return { hipY: 2 + Math.abs(s) * 3, tilt: 0.22, spin: 0, look: 0, uaL: 1.1 + s * 0.3, laL: 0.35, uaR: 0.2 - s * 0.25, laR: 0.55, ulL: -0.2, llL: 0.45, ulR: 0.55 + s * 0.35, llR: 0.25 };
  if (move === 4) return { hipY: 8 + (1 - Math.cos(w)) * 6, tilt: 0, spin: w, look: 0, uaL: 0.6, laL: 0.4, uaR: 1.3, laR: 0.3, ulL: -0.2, llL: 0.4, ulR: 0.55, llR: 0.35 };
  if (move === 5) return { hipY: Math.abs(s) * 6, tilt: 0.14, spin: 0, look: 0, uaL: 0.7 + s * 0.5, laL: 1.2, uaR: 1.1 - s * 0.5, laR: 1.2, ulL: -0.1, llL: 0.55, ulR: 0.35 + Math.abs(s) * 0.2, llR: 0.5 };
  if (move === 6) return { hipY: Math.abs(s) * 8, tilt: 0.2, spin: 0, look: 0, uaL: 0.35, laL: 0.45, uaR: 2.55 + s * 0.12, laR: 0.05, ulL: -0.15, llL: 0.55, ulR: 0.4, llR: 0.45 };
  if (move === 7) { const down = c * 0.5 + 0.5; return { hipY: 6 + down * 14, tilt: 0.12, spin: 0, look: 0, uaL: 0.55, laL: 0.9, uaR: 0.9, laR: 0.9, ulL: 0.35 + down * 0.45, llL: 0.9 + down * 0.25, ulR: 0.55 + down * 0.35, llR: 0.9 + down * 0.25 }; }
  if (move === 8) { const k = Math.sin(w + who * 0.35); return { hipY: 10 + k * 10, tilt: 0.25 + k * 0.2, spin: 0.15, look: 0, uaL: 0.4, laL: 0.3, uaR: 1.6, laR: 0.2, ulL: 0.15, llL: 0.3, ulR: 0.9, llR: 0.2 }; }
  return { hipY: Math.abs(s) * 4, tilt: 0.18, spin: 0, look: 0, uaL: 0.45, laL: 0.25, uaR: 1.4, laR: 0.15, ulL: -0.05, llL: 0.4, ulR: 0.35 + Math.max(0, s) * 1.45, llR: 0.12 };
}
function poseCool(who, t) {
  const w = t * Math.PI * 2, s = Math.sin(w), c = Math.cos(w);
  const set = who % 4;
  if (set === 0) return { hipY: 8 + (1 - c) * 10, tilt: 0, spin: w * 0.5, look: 0, uaL: 1.8, laL: 0.3, uaR: -0.2, laR: 1.2, ulL: 0.9, llL: 0.4, ulR: -0.3, llR: 0.9 };
  if (set === 1) { const up = Math.max(0, -c) * 12; return { hipY: up, tilt: 0.1, spin: 0, look: 0, uaL: 0.4 + s * 1.2, laL: 0.8, uaR: 2.2, laR: 0.1, ulL: 0.2, llL: 0.4, ulR: 0.5, llR: 0.3 }; }
  if (set === 2) return { hipY: Math.abs(s) * 8, tilt: 0.2, spin: s * 0.4, look: 0.4, uaL: 0.3, laL: 0.4, uaR: 2.4, laR: 0.1, ulL: -0.1, llL: 0.4, ulR: 0.3 + Math.max(0, s) * 1.5, llR: 0.1 };
  return { hipY: 12 + s * 10, tilt: 0.3, spin: 0.2, look: 0, uaL: 0.5, laL: 0.3, uaR: 1.5, laR: 0.2, ulL: 0.2, llL: 0.25, ulR: 0.85, llR: 0.2 };
}
function drawDude(x, ground, color, p) {
  const hipX = x, hipY = ground - 34 + p.hipY;
  ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(p.spin + (p.tilt || 0)); ctx.translate(-hipX, -hipY);
  const neckY = hipY - 22, headY = neckY - 10;
  drawHead(hipX, headY, color, p.tilt, p.look || 0);
  ctx.strokeStyle = color; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(hipX, neckY); ctx.lineTo(hipX, hipY); ctx.stroke();
  const eL = limb(hipX, neckY + 6, p.uaL, 14), hL = limb(eL[0], eL[1], p.uaL + p.laL, 12);
  const eR = limb(hipX, neckY + 6, p.uaR, 14), hR = limb(eR[0], eR[1], p.uaR + p.laR, 12);
  ctx.beginPath(); ctx.moveTo(hipX, neckY + 6); ctx.lineTo(eL[0], eL[1]); ctx.lineTo(hL[0], hL[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hipX, neckY + 6); ctx.lineTo(eR[0], eR[1]); ctx.lineTo(hR[0], hR[1]); ctx.stroke();
  const kL = limb(hipX, hipY, p.ulL, 16), fL = limb(kL[0], kL[1], p.ulL + p.llL, 16);
  const kR = limb(hipX, hipY, p.ulR, 16), fR = limb(kR[0], kR[1], p.ulR + p.llR, 16);
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
